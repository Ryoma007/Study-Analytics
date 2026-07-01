# Issue tracker: GitHub

本仓库的 Issues 和 PRD 以 GitHub Issues 形式存在。所有操作使用 `gh` CLI。

## 常用命令

- **创建 issue**: `gh issue create --title "..." --body "..."`。多行正文使用 heredoc。
- **查看 issue**: `gh issue view <number> --comments`，可通过 `jq` 过滤评论并获取标签。
- **列出 issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`，可按需添加 `--label` 和 `--state` 过滤。
- **评论 issue**: `gh issue comment <number> --body "..."`
- **添加/移除标签**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭 issue**: `gh issue close <number> --comment "..."`

仓库信息通过 `git remote -v` 自动推断——`gh` 在仓库内运行时会自动处理。

## 当技能说"发布到 issue tracker"

创建一个 GitHub Issue。

## 当技能说"获取相关工单"

执行 `gh issue view <number> --comments`。
