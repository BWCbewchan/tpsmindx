import catalog from './default-screen-catalog.json';

export interface ScreenCatalogItem {
  route_path: string;
  label: string;
  group_name: string;
  sort_order: number;
  description: string;
  is_active: boolean;
}

export const DEFAULT_SCREEN_CATALOG = catalog as ScreenCatalogItem[];
export const DEFAULT_SCREEN_CATALOG_JSON = JSON.stringify(DEFAULT_SCREEN_CATALOG);
