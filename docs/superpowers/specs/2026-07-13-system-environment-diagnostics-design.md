# 系统设置中的环境诊断

## 背景

Studio 当前把“环境诊断”作为 Tools 区域的独立页面展示，但诊断内容属于项目运行环境与系统配置，和 System 区域的“设置”职责重复且入口分散。

## 目标

- 将环境诊断作为设置页中的系统诊断卡片展示。
- 保留现有 `/api/v1/doctor` 检查逻辑与重新检查行为。
- 移除 Tools 区域的独立环境诊断入口，避免同一能力出现两个顶级入口。
- 旧的 `doctor` 页面路由仍可打开同一设置页，避免历史书签失效。

## 方案

1. 将 DoctorView 重构为可嵌入的 `EnvironmentDiagnostics` 卡片：使用设置页已有的主题、语言和卡片视觉体系，不再渲染独立页面标题。
2. 在 ProjectSettings 末尾加入环境诊断卡片，继续通过 `useApi("/doctor")` 获取状态，并提供“重新检查”按钮。
3. Sidebar 删除 Doctor 的 Tools 项及对应导航依赖；System 的设置项仍是唯一入口。
4. 将 `#/doctor` 解析为 `project-settings`，同时保留内部 `doctor` 类型的兼容处理，确保已有调用不会崩溃。

## 验证

- 路由测试确认 `#/doctor` 进入 `project-settings`。
- 导航状态测试确认 Doctor 不再作为独立导航页。
- 组件类型检查、Studio 定向测试及全量相关验证通过。
