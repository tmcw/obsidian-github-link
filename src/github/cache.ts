import type { IssueResponse, PullResponse, SearchIssueResponse, SearchRepoResponse } from "./response";

class CacheEntry<T> {
	constructor(
		public value: T,
		public created: Date = new Date(),
		public ttl: number = 20,
	) {}

	get expired(): boolean {
		const expiry = this.created.getTime() + this.ttl * 60 * 1000;

		return new Date().getTime() > expiry;
	}
}

class QueryCache {
	public readonly issueCache: Record<string, CacheEntry<SearchIssueResponse>> = {};
	public readonly repoCache: Record<string, CacheEntry<SearchRepoResponse>> = {};
}

class RepoCache {
	public readonly issueCache: Record<number, CacheEntry<IssueResponse>> = {};
	public readonly pullCache: Record<string, CacheEntry<PullResponse>> = {};
}

class OrgCache {
	public readonly repos: Record<string, RepoCache> = {};
}

export class Cache {
	public readonly generic: Record<string, CacheEntry<unknown>> = {};
	public readonly orgs: Record<string, OrgCache> = {};
	public readonly queries = new QueryCache();

	getGeneric(url: string): unknown | null {
		return this.getCacheValue(this.generic[url] ?? null);
	}

	setGeneric(url: string, value: unknown): void {
		this.generic[url] = new CacheEntry(value);
	}

	getIssue(org: string, repo: string, issue: number): IssueResponse | null {
		const repoCache = this.getRepoCache(org, repo);
		return this.getCacheValue(repoCache.issueCache[issue] ?? null);
	}

	setIssue(org: string, repo: string, issue: IssueResponse): void {
		const issueCache = this.getRepoCache(org, repo).issueCache;
		const existingCache = issueCache[issue.id];
		if (existingCache) {
			const now = new Date();
			existingCache.created = now;
			existingCache.value = issue;
		} else {
			issueCache[issue.id] = new CacheEntry<IssueResponse>(issue);
		}
	}

	getPullRequest(org: string, repo: string, pullRequest: number): PullResponse | null {
		const repoCache = this.getRepoCache(org, repo);
		return this.getCacheValue(repoCache.pullCache[pullRequest] ?? null);
	}

	setPullRequest(org: string, repo: string, pullRequest: PullResponse): void {
		const pullCache = this.getRepoCache(org, repo).pullCache;
		const existingCache = pullCache[pullRequest.id];
		if (existingCache) {
			const now = new Date();
			existingCache.created = now;
			existingCache.value = pullRequest;
		} else {
			pullCache[pullRequest.id] = new CacheEntry<PullResponse>(pullRequest);
		}
	}

	getIssueQuery(query: string): SearchIssueResponse | null {
		return this.getCacheValue(this.queries.issueCache[query] ?? null);
	}

	setIssueQuery(query: string, result: SearchIssueResponse): void {
		this.queries.issueCache[query] = new CacheEntry<SearchIssueResponse>(result);
	}

	getRepoQuery(query: string): SearchRepoResponse | null {
		return this.getCacheValue(this.queries.repoCache[query] ?? null);
	}

	setRepoQuery(query: string, result: SearchRepoResponse): void {
		this.queries.repoCache[query] = new CacheEntry<SearchRepoResponse>(result);
	}

	private getRepoCache(org: string, repo: string) {
		let orgCache = this.orgs[org];
		if (!orgCache) {
			orgCache = this.orgs[org] = new OrgCache();
		}
		let repoCache = orgCache.repos[repo];
		if (!repoCache) {
			repoCache = orgCache.repos[repo] = new RepoCache();
		}
		return repoCache;
	}

	private getCacheValue<T>(cacheEntry: CacheEntry<T> | null): T | null {
		if (!cacheEntry || cacheEntry.expired) {
			return null;
		} else {
			return cacheEntry.value;
		}
	}
}
