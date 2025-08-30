export interface Plot {
  id: string;
  plot_code: string;
  status: 'available' | 'taken' | 'pending';
  area_hectares: number;
  district: string;
  ward: string;
  village: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  attributes?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface OrderData {
  first_name: string;
  last_name: string;
  customer_phone: string;
  customer_email: string;
}

export interface Order {
  id: string;
  plot_id: string;
  first_name: string;
  last_name: string;
  customer_phone: string;
  customer_email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}