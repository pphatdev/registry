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
}

const DEFAULT_REGISTRY_URL = 'https://raw.githubusercontent.com/pphatdev/icons/main';
export const REGISTRY_URL = process.env.PPHAT_REGISTRY_URL || DEFAULT_REGISTRY_URL;

export async function fetchRegistryIndex(): Promise<RegistryIndexItem[] | null> {
    const indexUrl = `${REGISTRY_URL}/index.json`;
    const response = await fetch(indexUrl);

    if (!response.ok) {
        return null;
    }
    return await response.json();
}

export async function fetchRegistryItem(itemInfo: RegistryIndexItem): Promise<RegistryItem | null> {
    // Fallback if 'type' is missing from an older remote registry
    const type = itemInfo.type || itemInfo.target.split('/')[0] || 'icons';
    
    const targetJson = `${type}/${itemInfo.name}.json`;
    const itemUrl = `${REGISTRY_URL}/${targetJson}`;
    const response = await fetch(itemUrl);
    
    if (!response.ok) {
        return null;
    }

    return await response.json();
}
