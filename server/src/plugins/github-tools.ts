/** Reviewed initial grants. Newly advertised GitHub tools are never granted automatically. */
export const GITHUB_READ_TOOLS = Object.freeze([
  "get_me",
  "get_file_contents",
  "get_repository_tree",
  "get_commit",
  "list_commits",
  "list_branches",
  "search_repositories",
  "search_code",
  "search_issues",
  "search_pull_requests",
  "list_issues",
  "issue_read",
  "list_pull_requests",
  "pull_request_read",
]);

export const GITHUB_INITIAL_WRITE_TOOLS = Object.freeze([
  "issue_write",
  "create_branch",
  "create_pull_request",
]);
