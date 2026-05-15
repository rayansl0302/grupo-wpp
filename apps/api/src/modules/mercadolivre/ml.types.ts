export interface MLSearchParams {
  query?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  freeShipping?: boolean;
  sortBy?: 'price_asc' | 'price_desc' | 'relevance' | 'best_sellers';
  limit?: number;
  offset?: number;
}

export interface MLSearchResult {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  thumbnail: string;
  permalink: string;
  shipping: { free_shipping: boolean };
  seller: { nickname: string };
  attributes: Array<{ id: string; name: string; value_name: string | null }>;
  sold_quantity: number;
  reviews?: { rating_average: number };
  available_quantity: number;
}

export interface MLNormalizedProduct {
  mlId: string;
  title: string;
  originalPrice: number | null;
  salePrice: number;
  discount: number | null;
  thumbnail: string;
  permalink: string;
  freeShipping: boolean;
  seller: string | null;
  soldCount: number | null;
  rating: number | null;
  category: string | null;
}

export interface MLCategory {
  id: string;
  name: string;
}
