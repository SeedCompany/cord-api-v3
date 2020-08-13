"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.PublicLocation = exports.SecuredPrivateLocation = exports.PrivateLocation = exports.Location = exports.SecuredCountry = exports.Country = exports.SecuredRegion = exports.Region = exports.SecuredZone = exports.Zone = exports.Place = void 0;
var graphql_1 = require("@nestjs/graphql");
var common_1 = require("../../../common");
var private_location_type_enum_1 = require("./private-location-type.enum");
var Place = /** @class */ (function () {
    function Place() {
    }
    __decorate([
        graphql_1.Field()
    ], Place.prototype, "name");
    Place = __decorate([
        graphql_1.InterfaceType()
    ], Place);
    return Place;
}());
exports.Place = Place;
var Zone = /** @class */ (function (_super) {
    __extends(Zone, _super);
    function Zone() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    __decorate([
        graphql_1.Field()
    ], Zone.prototype, "name");
    Zone = __decorate([
        graphql_1.ObjectType({
            implements: [common_1.Resource, Place]
        })
    ], Zone);
    return Zone;
}(common_1.Resource));
exports.Zone = Zone;
var SecuredZone = /** @class */ (function (_super) {
    __extends(SecuredZone, _super);
    function SecuredZone() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SecuredZone = __decorate([
        graphql_1.ObjectType({
            description: common_1.SecuredProperty.descriptionFor('a zone')
        })
    ], SecuredZone);
    return SecuredZone;
}(common_1.SecuredProperty(Zone)));
exports.SecuredZone = SecuredZone;
var Region = /** @class */ (function (_super) {
    __extends(Region, _super);
    function Region() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    __decorate([
        graphql_1.Field()
    ], Region.prototype, "name");
    Region = __decorate([
        graphql_1.ObjectType({
            implements: [common_1.Resource, Place]
        })
    ], Region);
    return Region;
}(common_1.Resource));
exports.Region = Region;
var SecuredRegion = /** @class */ (function (_super) {
    __extends(SecuredRegion, _super);
    function SecuredRegion() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SecuredRegion = __decorate([
        graphql_1.ObjectType({
            description: common_1.SecuredProperty.descriptionFor('a region')
        })
    ], SecuredRegion);
    return SecuredRegion;
}(common_1.SecuredProperty(Region)));
exports.SecuredRegion = SecuredRegion;
var Country = /** @class */ (function (_super) {
    __extends(Country, _super);
    function Country() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    __decorate([
        graphql_1.Field()
    ], Country.prototype, "name");
    __decorate([
        graphql_1.Field()
    ], Country.prototype, "region");
    Country = __decorate([
        graphql_1.ObjectType({
            implements: [common_1.Resource, Place]
        })
    ], Country);
    return Country;
}(common_1.Resource));
exports.Country = Country;
var SecuredCountry = /** @class */ (function (_super) {
    __extends(SecuredCountry, _super);
    function SecuredCountry() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SecuredCountry = __decorate([
        graphql_1.ObjectType({
            description: common_1.SecuredProperty.descriptionFor('a country')
        })
    ], SecuredCountry);
    return SecuredCountry;
}(common_1.SecuredProperty(Country)));
exports.SecuredCountry = SecuredCountry;
exports.Location = graphql_1.createUnionType({
    name: 'Location',
    types: function () { return [Country, Region, Zone]; },
    resolveType: function (value) {
        if ('region' in value) {
            return Country;
        }
        if ('zone' in value) {
            return Region;
        }
        return Zone;
    }
});
var PrivateLocation = /** @class */ (function (_super) {
    __extends(PrivateLocation, _super);
    function PrivateLocation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    __decorate([
        graphql_1.Field()
    ], PrivateLocation.prototype, "name");
    __decorate([
        graphql_1.Field()
    ], PrivateLocation.prototype, "publicName");
    __decorate([
        graphql_1.Field(function () { return common_1.Sensitivity; })
    ], PrivateLocation.prototype, "sensitivity");
    __decorate([
        graphql_1.Field(function () { return private_location_type_enum_1.PrivateLocationType; })
    ], PrivateLocation.prototype, "type");
    PrivateLocation = __decorate([
        graphql_1.ObjectType({
            implements: [common_1.Resource]
        })
    ], PrivateLocation);
    return PrivateLocation;
}(common_1.Resource));
exports.PrivateLocation = PrivateLocation;
var SecuredPrivateLocation = /** @class */ (function (_super) {
    __extends(SecuredPrivateLocation, _super);
    function SecuredPrivateLocation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    SecuredPrivateLocation = __decorate([
        graphql_1.ObjectType({
            description: common_1.SecuredProperty.descriptionFor('a private location')
        })
    ], SecuredPrivateLocation);
    return SecuredPrivateLocation;
}(common_1.SecuredProperty(PrivateLocation)));
exports.SecuredPrivateLocation = SecuredPrivateLocation;
var PublicLocation = /** @class */ (function (_super) {
    __extends(PublicLocation, _super);
    function PublicLocation() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    __decorate([
        graphql_1.Field()
    ], PublicLocation.prototype, "fieldRegion");
    __decorate([
        graphql_1.Field()
    ], PublicLocation.prototype, "marketingLocation");
    __decorate([
        graphql_1.Field()
    ], PublicLocation.prototype, "privateLocation");
    __decorate([
        graphql_1.Field()
    ], PublicLocation.prototype, "registryOfGeography");
    __decorate([
        graphql_1.Field()
    ], PublicLocation.prototype, "fundingAccount");
    PublicLocation = __decorate([
        graphql_1.ObjectType({
            implements: [common_1.Resource]
        })
    ], PublicLocation);
    return PublicLocation;
}(common_1.Resource));
exports.PublicLocation = PublicLocation;
