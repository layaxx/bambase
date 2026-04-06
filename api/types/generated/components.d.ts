import type { Schema, Struct } from "@strapi/strapi"

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
      "mensa.allergens": MensaAllergens
    }
  }
}
