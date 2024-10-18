// src/interfaces/ThemaDetails.ts

export interface ThemaDetailsResponse {
    cm_thema: ThemaDetails;
}

export interface ThemaDetails {
    id: number;
    name: string;
    owner_id: number | null;
    custom_field: CustomFields;
    created_at: string;
    creator_id: number;
    updated_at: string;
    updater_id: number | null;
    avatar: string | null;
    recent_note: string | null;
    links: ThemaLinks;
    record_type_id: string;
}

export interface CustomFields {
    cf_genre_subgenre?: number;
    // Add other custom fields if necessary
}

export interface ThemaLinks {
    document_associations: string;
    notes: string;
}