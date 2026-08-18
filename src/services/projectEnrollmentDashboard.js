export function createEmptyProjectEnrollmentView(projects) {
  return {
    items: projects.map((project) => ({
      id: project.id,
      name: project.name,
      iconUrl: project.iconUrl,
      value: 0,
      color: project.color,
    })),
    membersByProject: Object.fromEntries(
      projects.map((project) => [project.name, []]),
    ),
    projectProgressesByUserId: {},
  }
}

export function attachProjectProgressesToMembers(members, projectProgressesByUserId) {
  return members.map((member) => ({
    ...member,
    projectProgresses: projectProgressesByUserId[member.id] ?? [],
  }))
}

export function createProjectEnrollmentView(
  projects,
  recordsByProjectId,
  userMembers,
) {
  const memberByUserId = new Map(userMembers.map((member) => [member.id, member]))
  const membersByProject = {}
  const projectProgressesByUserId = Object.fromEntries(
    userMembers.map((member) => [member.id, []]),
  )

  const items = projects.map((project) => {
    const records = recordsByProjectId.get(project.id) ?? []
    membersByProject[project.name] = records.flatMap((record) => {
      const member = memberByUserId.get(record.userId)
      if (!member) return []

      const progress = Math.round(record.completionProgress * 100)
      // 同一批组合查询同时建立用户视角，等级名单可直接复用而不再请求项目数据。
      projectProgressesByUserId[record.userId].push({
        projectId: project.id,
        projectName: project.name,
        progress,
      })

      return [{
        ...member,
        seasonUserId: record.seasonUserId,
        levelId: record.levelId,
        level: record.levelName,
        // 后端使用 0～1，展示层统一消费整数百分比。
        progress,
      }]
    })

    return {
      ...project,
      value: records.length,
    }
  })

  return { items, membersByProject, projectProgressesByUserId }
}
