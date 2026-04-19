import type { Schema, Struct } from "@strapi/strapi"

export interface EventsEventLocation extends Struct.ComponentSchema {
  collectionName: "components_events_event_locations"
  info: {
    displayName: "EventLocation"
  }
  attributes: {
    address: Schema.Attribute.String
    city: Schema.Attribute.String
    name: Schema.Attribute.String & Schema.Attribute.Required
  }
}

export interface JobsContact extends Struct.ComponentSchema {
  collectionName: "components_jobs_contacts"
  info: {
    displayName: "contact"
  }
  attributes: {
    mail: Schema.Attribute.Email
    name: Schema.Attribute.String & Schema.Attribute.Required
    phone: Schema.Attribute.String
  }
}

export interface MapAddress extends Struct.ComponentSchema {
  collectionName: "components_map_addresses"
  info: {
    displayName: "address"
  }
  attributes: {
    city: Schema.Attribute.String
    street: Schema.Attribute.String
    streetNumber: Schema.Attribute.String
    zip: Schema.Attribute.Integer
  }
}

export interface MensaAllergens extends Struct.ComponentSchema {
  collectionName: "components_mensa_allergens"
  info: {
    displayName: "allergens"
    icon: "restaurant"
  }
  attributes: {
    name: Schema.Attribute.String & Schema.Attribute.Required
  }
}

declare module "@strapi/strapi" {
  export module Public {
    export interface ComponentSchemas {
      "events.event-location": EventsEventLocation
      "jobs.contact": JobsContact
      "map.address": MapAddress
      "mensa.allergens": MensaAllergens
    }
  }
}
