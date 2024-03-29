"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

async function createShippingOptionAfterDelegation(shippingOption) {
  const {
    region,
    profile: shipping_profile,
    requirements: shipping_option_requirements,
    provider: fulfillment_provider,
    ...createPayload
  } = shippingOption;

  if (region) {
    createPayload.region = await strapi
      .service("api::region.region")
      .handleManyToOneRelation(region, "shipping-option");
  }

  if (shipping_profile) {
    createPayload.shipping_profile = await strapi
      .service("api::shipping-profile.shipping-profile")
      .handleManyToOneRelation(shipping_profile, "shipping-option");
  }

  if (shipping_option_requirements && shipping_option_requirements.length) {
    createPayload.shipping_option_requirements = await strapi
      .service("api::shipping-option-requirement.shipping-option-requirement")
      .handleOneToManyRelation(shipping_option_requirements, "shipping-option");
  }

  if (fulfillment_provider) {
    createPayload.fulfillment_provider = await strapi
      .service("api::fulfillment-provider.fulfillment-provider")
      .handleManyToOneRelation(fulfillment_provider, "shipping-option");
  }

  const create = await strapi.entityService.create(
    "api::shipping-option.shipping-option",
    { data: createPayload }
  );
  return create.id;
}

const { createCoreService } = require("@strapi/strapi").factories;

module.exports = createCoreService(
  "api::shipping-option.shipping-option",
  ({ strapi }) => ({
    async bootstrap(data) {
      strapi.log.debug("Syncing Shipping Options....");

      try {
        if (data && data.length) {
          for (let shipping_option of data) {
            if (!shipping_option.medusa_id) {
              shipping_option.medusa_id = shipping_option.id.toString();
              delete shipping_option.id;
            }

            const found = await strapi.db
              .query("api::shipping-option.shipping-option")
              .findOne({ where: { medusa_id: shipping_option.medusa_id } });
            if (found) {
              continue;
            }

            const shippingOptionStrapiId =
              await createShippingOptionAfterDelegation(shipping_option);
          }
        }
        strapi.log.info("Shipping Options Synced");
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    },

    async handleOneToManyRelation(shippingOptions, caller) {
      const shippingOptionsStrapiIds = [];

      try {
        if (shippingOptions && shippingOptions.length) {
          for (let shippingOption of shippingOptions) {
            if (shippingOption.id) {
              shippingOption.medusa_id = shippingOption.id;
              delete shippingOption.id;
            }

            // This prevents an infinite loop. Since a cycle exists:  shipping_option -> shipping_profile -> shipping_option
            if (caller === "shipping-profile") {
              delete shippingOption.shipping_profile;
              delete shippingOption.profile;
            }

            const found = await strapi.db
              .query("api::shipping-option.shipping-option")
              .findOne({ where: { medusa_id: shippingOption.medusa_id } });
            if (found) {
              shippingOptionsStrapiIds.push({ id: found.id });
              continue;
            }

            const create = await createShippingOptionAfterDelegation(
              shippingOption
            );
            shippingOptionsStrapiIds.push({ id: create });
          }
        }
        return shippingOptionsStrapiIds;
      } catch (e) {
        console.log(e);
        throw new Error("Delegated creation failed");
      }
    },
  })
);
