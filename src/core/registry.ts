export interface RegistryItemFile {
    path: string;
    content: string;
}

export interface RegistryItem {
    name: string;
    files: RegistryItemFile[];
}

export interface RegistryIndexItem {
    name: string;
    type: string;
    target: string;
    repo?: 'icons' | 'components';
}

const DEFAULT_ICONS_REGISTRY_URL = 'https://raw.githubusercontent.com/pphatdev/icons/main';
const DEFAULT_COMPONENTS_REGISTRY_URL = 'https://raw.githubusercontent.com/pphatdev/components/main';

export const ICONS_REGISTRY_URL = process.env.PPHAT_ICONS_REGISTRY_URL || DEFAULT_ICONS_REGISTRY_URL;
export const COMPONENTS_REGISTRY_URL = process.env.PPHAT_COMPONENTS_REGISTRY_URL || DEFAULT_COMPONENTS_REGISTRY_URL;

/**
* Fetch Registry Index
* @description Fetches the full index list of available items from the registry
* @param repo Optional filter to fetch from a specific repository (icons or components)
* @returns An array of registry index items or null if fetching fails
*/
export async function fetchRegistryIndex(repo?: 'icons' | 'components'): Promise<RegistryIndexItem[] | null> {
    async function fetchRepoItems(repoUrl: string, repoType: 'icons' | 'components'): Promise<RegistryIndexItem[]> {
        try {
            const response = await fetch(`${repoUrl}/index.json`);
            if (!response.ok) return [];
            const indexData = await response.json();
            
            let allItems: RegistryIndexItem[] = [];
            
            for (const item of indexData) {
                if (item.target && item.target.endsWith('.json') && !item.target.includes('/')) {
                    const catRes = await fetch(`${repoUrl}/${item.target}`);
                    if (catRes.ok) {
                        const catItems = await catRes.json();
                        allItems = allItems.concat(catItems.map((i: any) => ({ ...i, repo: repoType })));
                    }
                } else {
                    allItems.push({ ...item, repo: repoType });
                }
            }
            return allItems;
        } catch {
            return [];
        }
    }

    if (repo === 'icons') {
        const items = await fetchRepoItems(ICONS_REGISTRY_URL, 'icons');
        return items.length > 0 ? items : null;
    } else if (repo === 'components') {
        const items = await fetchRepoItems(COMPONENTS_REGISTRY_URL, 'components');
        return items.length > 0 ? items.map(i => ({ ...i, type: 'components' })) : null;
    } else {
        const [icons, components] = await Promise.all([
            fetchRepoItems(ICONS_REGISTRY_URL, 'icons'),
            fetchRepoItems(COMPONENTS_REGISTRY_URL, 'components')
        ]);

        let items: RegistryIndexItem[] = [];
        items = items.concat(icons);
        items = items.concat(components.map(i => ({ ...i, type: 'components' })));

        if (items.length === 0) return null;
        return items;
    }
}

/**
* Fetch Registry Item
* @description Fetches the complete metadata and file contents for a specific registry item
* @param itemInfo The index metadata for the item to fetch
* @returns The full registry item or null if fetching fails
*/
export async function fetchRegistryItem(itemInfo: RegistryIndexItem): Promise<RegistryItem | null> {
    const isComponent = itemInfo.type === 'components' || itemInfo.repo === 'components';
    const baseUrl = isComponent ? COMPONENTS_REGISTRY_URL : ICONS_REGISTRY_URL;
    
    let targetJson = itemInfo.target;
    if (!targetJson) {
        const type = itemInfo.type || (isComponent ? 'components' : 'icons');
        targetJson = `${type}/${itemInfo.name}.json`;
    }
    const itemUrl = `${baseUrl}/${targetJson}`;
    const response = await fetch(itemUrl);
    
    if (!response.ok) {
        return null;
    }

    return await response.json();
}
