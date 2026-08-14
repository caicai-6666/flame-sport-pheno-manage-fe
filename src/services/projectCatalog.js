const PROJECT_COLORS = [
  '#8579e4',
  '#5aa9dc',
  '#50bea0',
  '#efaa67',
  '#ee7f88',
  '#95b958',
]

export function getProjectCatalogColor(index) {
  return PROJECT_COLORS[index % PROJECT_COLORS.length]
}

export function createProjectCatalog(projects) {
  return projects.map((project, index) => ({
    id: project.projectId,
    name: project.projectName,
    description: project.description,
    iconUrl: project.iconUrl,
    status: project.status,
    color: getProjectCatalogColor(index),
  }))
}

export function getVisibleProjectCatalog(projects) {
  // 普通业务只能消费显式可见项目，不能把“接口已返回”等同于“用户可选”。
  return projects.filter((project) => project.status === 1)
}
