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
  }
}

export function createProjectEnrollmentView(
  projects,
  recordsByProjectId,
  userMembers,
) {
  const memberByUserId = new Map(userMembers.map((member) => [member.id, member]))
  const membersByProject = {}

  const items = projects.map((project) => {
    const records = recordsByProjectId.get(project.id) ?? []
    membersByProject[project.name] = records.flatMap((record) => {
      const member = memberByUserId.get(record.userId)
      if (!member) return []

      return [{
        ...member,
        seasonUserId: record.seasonUserId,
        levelId: record.levelId,
        level: record.levelName,
        // 后端使用 0～1，展示层统一消费整数百分比。
        progress: Math.round(record.completionProgress * 100),
      }]
    })

    return {
      ...project,
      value: records.length,
    }
  })

  return { items, membersByProject }
}
