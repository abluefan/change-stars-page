// background.js – 修正版（GraphQL 查询 lists 在 Repository 节点上）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchStarredLists') {
    const { token } = request;
    (async () => {
      try {
        const data = await fetchAllWithGraphQL(token);
        sendResponse({ success: true, data });
      } catch (err) {
        console.error('同步失败：', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});

async function graphql(query, variables, token) {
  const resp = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, variables })
  });
  const json = await resp.json();
  if (!resp.ok || json.errors) {
    const msg = json.errors
      ? json.errors.map(e => e.message).join('; ')
      : `HTTP ${resp.status}: ${JSON.stringify(json)}`;
    throw new Error(msg);
  }
  return json;
}

async function fetchAllWithGraphQL(token) {
  const result = {};
  let hasMore = true;
  let cursor = null;

  while (hasMore) {
    const query = `
      query($first: Int!, $after: String) {
        viewer {
          starredRepositories(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                nameWithOwner
                lists(first: 10) {
                  edges {
                    node {
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const variables = { first: 100, after: cursor };
    const json = await graphql(query, variables, token);
    
    const viewer = json.data?.viewer;
    if (!viewer) throw new Error('未获取到用户数据，请检查 Token 权限（需要 read:user 和 public_repo）');
    
    const repos = viewer.starredRepositories.edges;
    for (const repoEdge of repos) {
      const repo = repoEdge.node;
      const lists = repo.lists.edges;
      result[repo.nameWithOwner] = lists.length > 0;
    }
    
    hasMore = viewer.starredRepositories.pageInfo.hasNextPage;
    cursor = viewer.starredRepositories.pageInfo.endCursor;
  }
  return result;
}