export interface LocationRequest {
  name: string;
  city: string;
  address: string;
  active: boolean;
  email: string;
  phoneNumber: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface LocationResponse extends LocationRequest {
  id: string;
}

export interface LocationPatchRequest {
  name?: string;
  city?: string;
  address?: string;
  active?: boolean;
  email?: string;
  phoneNumber?: string;
  startTime?: string;
  endTime?: string;
}
