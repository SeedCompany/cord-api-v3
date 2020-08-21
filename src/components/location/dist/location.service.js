"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.LocationService = void 0;
var common_1 = require("@nestjs/common");
var cypher_query_builder_1 = require("cypher-query-builder");
var lodash_1 = require("lodash");
var luxon_1 = require("luxon");
var shortid_1 = require("shortid");
var common_2 = require("../../common");
var core_1 = require("../../core");
var results_1 = require("../../core/database/results");
var LocationService = /** @class */ (function () {
    function LocationService(logger, config, db, userService, marketingLocationService, projectService, fundingAccountService, registryOfGeographyService) {
        this.logger = logger;
        this.config = config;
        this.db = db;
        this.userService = userService;
        this.marketingLocationService = marketingLocationService;
        this.projectService = projectService;
        this.fundingAccountService = fundingAccountService;
        this.registryOfGeographyService = registryOfGeographyService;
        // helper method for defining properties
        this.property = function (prop, value, baseNode, extraLabels) {
            if (!value) {
                return [];
            }
            var createdAt = luxon_1.DateTime.local();
            var propLabel = __spreadArrays(['Property'], (extraLabels || []));
            return [
                [
                    cypher_query_builder_1.node(baseNode),
                    cypher_query_builder_1.relation('out', '', prop, {
                        active: true,
                        createdAt: createdAt
                    }),
                    cypher_query_builder_1.node(prop, propLabel, {
                        active: true,
                        value: value
                    }),
                ],
            ];
        };
        // helper method for defining permissions
        this.permission = function (property, baseNode) {
            var createdAt = luxon_1.DateTime.local();
            return [
                [
                    cypher_query_builder_1.node('adminSG'),
                    cypher_query_builder_1.relation('out', '', 'permission', {
                        active: true,
                        createdAt: createdAt
                    }),
                    cypher_query_builder_1.node('', 'Permission', {
                        property: property,
                        active: true,
                        read: true,
                        edit: true,
                        admin: true
                    }),
                    cypher_query_builder_1.relation('out', '', 'baseNode', {
                        active: true,
                        createdAt: createdAt
                    }),
                    cypher_query_builder_1.node(baseNode),
                ],
                [
                    cypher_query_builder_1.node('readerSG'),
                    cypher_query_builder_1.relation('out', '', 'permission', {
                        active: true,
                        createdAt: createdAt
                    }),
                    cypher_query_builder_1.node('', 'Permission', {
                        property: property,
                        active: true,
                        read: true,
                        edit: false,
                        admin: false
                    }),
                    cypher_query_builder_1.relation('out', '', 'baseNode', {
                        active: true,
                        createdAt: createdAt
                    }),
                    cypher_query_builder_1.node(baseNode),
                ],
            ];
        };
    }
    LocationService.prototype.createIndexes = function () {
        return __awaiter(this, void 0, void 0, function () {
            var constraints, _i, constraints_1, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        constraints = [
                            // ZONE NODE
                            'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.id)',
                            'CREATE CONSTRAINT ON (n:FieldZone) ASSERT n.id IS UNIQUE',
                            'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.active)',
                            'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.createdAt)',
                            'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.owningOrgId)',
                            // ZONE NAME REL
                            'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
                            'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',
                            // ZONE NAME NODE
                            'CREATE CONSTRAINT ON (n:FieldZoneName) ASSERT EXISTS(n.value)',
                            'CREATE CONSTRAINT ON (n:FieldZoneName) ASSERT n.value IS UNIQUE',
                            // REGION NODE
                            'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.id)',
                            'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT n.id IS UNIQUE',
                            'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.active)',
                            'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.createdAt)',
                            'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.owningOrgId)',
                            // REGION NAME REL
                            'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
                            'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',
                            // REGION NAME NODE
                            'CREATE CONSTRAINT ON (n:FieldRegionName) ASSERT EXISTS(n.value)',
                            'CREATE CONSTRAINT ON (n:FieldRegionName) ASSERT n.value IS UNIQUE',
                            // COUNTRY NODE
                            'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.id)',
                            'CREATE CONSTRAINT ON (n:Country) ASSERT n.id IS UNIQUE',
                            'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.active)',
                            'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.createdAt)',
                            'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.owningOrgId)',
                            // COUNTRY NAME REL
                            'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
                            'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',
                            // COUNTRY NAME NODE
                            'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
                            'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',
                            // PUBLICLOCATION NODE
                            'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.id)',
                            'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT n.id IS UNIQUE',
                            'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.active)',
                            'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.createdAt)',
                            'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.owningOrgId)',
                            //PRIVATELOCATION NODE
                            'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.id)',
                            'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT n.id IS UNIQUE',
                            'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.active)',
                            'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.createdAt)',
                            'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.owningOrgId)',
                            'CREATE CONSTRAINT ON ()-[r:publicName]-() ASSERT EXISTS(r.active)',
                            'CREATE CONSTRAINT ON ()-[r:publicName]-() ASSERT EXISTS(r.createdAt)',
                        ];
                        _i = 0, constraints_1 = constraints;
                        _a.label = 1;
                    case 1:
                        if (!(_i < constraints_1.length)) return [3 /*break*/, 4];
                        query = constraints_1[_i];
                        return [4 /*yield*/, this.db.query().raw(query).run()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        _i++;
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.createZone = function (_a, session) {
        var directorId = _a.directorId, input = __rest(_a, ["directorId"]);
        return __awaiter(this, void 0, Promise, function () {
            var id, createdAt, createZone, query, addDirector, _b, lookup, zone, e_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        id = shortid_1.generate();
                        createdAt = luxon_1.DateTime.local();
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 5, , 7]);
                        createZone = this.db
                            .query()
                            .match(core_1.matchSession(session, { withAclEdit: 'canCreateZone' }))
                            .match([
                            cypher_query_builder_1.node('rootuser', 'User', {
                                active: true,
                                id: this.config.rootAdmin.id
                            }),
                        ])
                            .create(__spreadArrays([
                            [
                                cypher_query_builder_1.node('newZone', ['FieldZone', 'BaseNode'], {
                                    active: true,
                                    createdAt: createdAt,
                                    id: id,
                                    owningOrgId: session.owningOrgId
                                }),
                            ]
                        ], this.property('name', input.name, 'newZone', ['FieldZoneName']), [
                            [
                                cypher_query_builder_1.node('adminSG', 'SecurityGroup', {
                                    id: shortid_1.generate(),
                                    active: true,
                                    createdAt: createdAt,
                                    name: input.name + ' admin'
                                }),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('requestingUser'),
                            ],
                            [
                                cypher_query_builder_1.node('readerSG', 'SecurityGroup', {
                                    id: shortid_1.generate(),
                                    active: true,
                                    createdAt: createdAt,
                                    name: input.name + ' users'
                                }),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('requestingUser'),
                            ],
                            [
                                cypher_query_builder_1.node('adminSG'),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('rootuser'),
                            ],
                            [
                                cypher_query_builder_1.node('readerSG'),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('rootuser'),
                            ]
                        ], this.permission('name', 'newZone'), this.permission('director', 'newZone')))["return"]('newZone.id as id');
                        return [4 /*yield*/, createZone.first()];
                    case 2:
                        _c.sent();
                        if (!directorId) return [3 /*break*/, 4];
                        query = "\n      MATCH (director:User {id: $directorId, active: true}),\n        (zone:FieldZone {id: $id, active: true})\n      CREATE (director)<-[:director {active: true, createdAt: datetime()}]-(zone)\n      RETURN  zone.id as id\n      ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                userId: session.userId,
                                directorId: directorId,
                                id: id
                            })
                                .first()];
                    case 3:
                        addDirector = _c.sent();
                        if (!addDirector) {
                            throw new Error('already exists, try finding it');
                        }
                        _c.label = 4;
                    case 4: return [3 /*break*/, 7];
                    case 5:
                        _b = _c.sent();
                        lookup = this.db
                            .query()
                            .match([
                            cypher_query_builder_1.node('zone', 'FieldZone', { active: true }),
                            cypher_query_builder_1.relation('out', 'name', 'name', { active: true }),
                            cypher_query_builder_1.node('zoneName', 'Property', { active: true, value: input.name }),
                        ])["return"]({
                            zone: [{ id: 'zoneId' }]
                        });
                        return [4 /*yield*/, lookup.first()];
                    case 6:
                        zone = _c.sent();
                        if (zone) {
                            id = zone.zoneId;
                        }
                        else {
                            throw new common_1.InternalServerErrorException('Cannot create Zone, cannot find matching name');
                        }
                        return [3 /*break*/, 7];
                    case 7:
                        _c.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, this.readOneZone(id, session)];
                    case 8: return [2 /*return*/, _c.sent()];
                    case 9:
                        e_1 = _c.sent();
                        throw new common_1.InternalServerErrorException('Could not create zone');
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.createRegion = function (_a, session) {
        var zoneId = _a.zoneId, directorId = _a.directorId, input = __rest(_a, ["zoneId", "directorId"]);
        return __awaiter(this, void 0, Promise, function () {
            var id, createdAt, createRegion, query, query, e_2, lookup, region, e_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = shortid_1.generate();
                        createdAt = luxon_1.DateTime.local();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 7, , 9]);
                        createRegion = this.db
                            .query()
                            .match(core_1.matchSession(session, { withAclEdit: 'canCreateRegion' }))
                            .match([
                            cypher_query_builder_1.node('rootuser', 'User', {
                                active: true,
                                id: this.config.rootAdmin.id
                            }),
                        ])
                            .create(__spreadArrays([
                            [
                                cypher_query_builder_1.node('newRegion', ['FieldRegion', 'BaseNode'], {
                                    active: true,
                                    createdAt: createdAt,
                                    id: id,
                                    owningOrgId: session.owningOrgId
                                }),
                            ]
                        ], this.property('name', input.name, 'newRegion', [
                            'FieldRegionName',
                        ]), [
                            [
                                cypher_query_builder_1.node('adminSG', 'SecurityGroup', {
                                    id: shortid_1.generate(),
                                    active: true,
                                    createdAt: createdAt,
                                    name: input.name + ' admin'
                                }),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('requestingUser'),
                            ],
                            [
                                cypher_query_builder_1.node('readerSG', 'SecurityGroup', {
                                    id: shortid_1.generate(),
                                    active: true,
                                    createdAt: createdAt,
                                    name: input.name + ' users'
                                }),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('requestingUser'),
                            ],
                            [
                                cypher_query_builder_1.node('adminSG'),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('rootuser'),
                            ],
                            [
                                cypher_query_builder_1.node('readerSG'),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('rootuser'),
                            ]
                        ], this.permission('name', 'newRegion'), this.permission('director', 'newRegion'), this.permission('zone', 'newRegion')))["return"]('newRegion.id as id');
                        return [4 /*yield*/, createRegion.first()];
                    case 2:
                        _b.sent();
                        this.logger.info("Region created", { input: input, userId: session.userId });
                        if (!zoneId) return [3 /*break*/, 4];
                        query = "\n          MATCH (zone:FieldZone {id: $zoneId, active: true}),\n            (region:FieldRegion {id: $id, active: true})\n          CREATE (zone)<-[:zone { active: true, createdAt: datetime() }]-(region)\n          RETURN region.id as id\n        ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                zoneId: zoneId,
                                id: id
                            })
                                .first()];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        if (!directorId) return [3 /*break*/, 6];
                        query = "\n          MATCH\n            (region:FieldRegion {id: $id, active: true}),\n            (director:User {id: $directorId, active: true})\n          CREATE (director)<-[:director { active: true, createdAt: datetime() }]-(region)\n          RETURN region.id as id\n        ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                id: id,
                                directorId: directorId
                            })
                                .first()];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6: return [3 /*break*/, 9];
                    case 7:
                        e_2 = _b.sent();
                        lookup = this.db
                            .query()
                            .match([
                            cypher_query_builder_1.node('region', 'FieldRegion', { active: true }),
                            cypher_query_builder_1.relation('out', 'name', 'name', { active: true }),
                            cypher_query_builder_1.node('regionName', 'Property', { active: true, value: input.name }),
                        ])["return"]({ region: [{ id: 'regionId' }] });
                        return [4 /*yield*/, lookup.first()];
                    case 8:
                        region = _b.sent();
                        if (region) {
                            id = region.regionId;
                        }
                        else {
                            this.logger.warning("Could not create region", {
                                exception: e_2
                            });
                            throw new common_1.InternalServerErrorException('Could not create region');
                        }
                        return [3 /*break*/, 9];
                    case 9:
                        _b.trys.push([9, 11, , 12]);
                        return [4 /*yield*/, this.readOneRegion(id, session)];
                    case 10: return [2 /*return*/, _b.sent()];
                    case 11:
                        e_3 = _b.sent();
                        throw new common_1.InternalServerErrorException('Could not create region');
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.createCountry = function (_a, session) {
        var regionId = _a.regionId, input = __rest(_a, ["regionId"]);
        return __awaiter(this, void 0, Promise, function () {
            var id, createdAt, createCountry, query, e_4, lookup, country, e_5;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        id = shortid_1.generate();
                        createdAt = luxon_1.DateTime.local();
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 5, , 7]);
                        createCountry = this.db
                            .query()
                            .match(core_1.matchSession(session, { withAclEdit: 'canCreateCountry' }))
                            .match([
                            cypher_query_builder_1.node('rootuser', 'User', {
                                active: true,
                                id: this.config.rootAdmin.id
                            }),
                        ])
                            .create(__spreadArrays([
                            [
                                cypher_query_builder_1.node('newCountry', ['Country', 'BaseNode'], {
                                    active: true,
                                    createdAt: createdAt,
                                    id: id,
                                    owningOrgId: session.owningOrgId
                                }),
                            ]
                        ], this.property('name', input.name, 'newCountry', ['LocationName']), [
                            [
                                cypher_query_builder_1.node('adminSG', 'SecurityGroup', {
                                    id: shortid_1.generate(),
                                    active: true,
                                    createdAt: createdAt,
                                    name: input.name + ' admin'
                                }),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('requestingUser'),
                            ],
                            [
                                cypher_query_builder_1.node('readerSG', 'SecurityGroup', {
                                    id: shortid_1.generate(),
                                    active: true,
                                    createdAt: createdAt,
                                    name: input.name + ' users'
                                }),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('requestingUser'),
                            ],
                            [
                                cypher_query_builder_1.node('adminSG'),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('rootuser'),
                            ],
                            [
                                cypher_query_builder_1.node('readerSG'),
                                cypher_query_builder_1.relation('out', '', 'member', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('rootuser'),
                            ]
                        ], this.permission('name', 'newCountry'), this.permission('region', 'newCountry')))["return"]('newCountry.id as id');
                        return [4 /*yield*/, createCountry.first()];
                    case 2:
                        _b.sent();
                        this.logger.info("country created");
                        if (!regionId) return [3 /*break*/, 4];
                        query = "\n          MATCH (region:FieldRegion {id: $regionId, active: true}),\n            (country:Country {id: $id, active: true})\n          CREATE (country)-[:region { active: true, createdAt: datetime()}]->(region)\n          RETURN country.id as id\n        ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                regionId: regionId,
                                id: id
                            })
                                .first()];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4: return [3 /*break*/, 7];
                    case 5:
                        e_4 = _b.sent();
                        lookup = this.db
                            .query()
                            .match([
                            cypher_query_builder_1.node('country', 'Country', { active: true }),
                            cypher_query_builder_1.relation('out', 'name', 'name', { active: true }),
                            cypher_query_builder_1.node('countryName', 'Property', { active: true, value: input.name }),
                        ])["return"]({ country: [{ id: 'countryId' }] });
                        return [4 /*yield*/, lookup.first()];
                    case 6:
                        country = _b.sent();
                        if (country) {
                            id = country.countryId;
                        }
                        else {
                            this.logger.warning("Could not create country", {
                                exception: e_4
                            });
                            throw new common_1.InternalServerErrorException('Could not create country');
                        }
                        return [3 /*break*/, 7];
                    case 7:
                        _b.trys.push([7, 9, , 10]);
                        return [4 /*yield*/, this.readOneCountry(id, session)];
                    case 8: return [2 /*return*/, _b.sent()];
                    case 9:
                        e_5 = _b.sent();
                        throw new common_1.InternalServerErrorException('Could not create country');
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.createPublicLocation = function (input, session) {
        return __awaiter(this, void 0, Promise, function () {
            var createdAt, query, result, id, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        createdAt = luxon_1.DateTime.local();
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 5, , 6]);
                        query = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .match([
                            cypher_query_builder_1.node('rootUser', 'User', {
                                active: true,
                                id: this.config.rootAdmin.id
                            }),
                        ])
                            .match([
                            cypher_query_builder_1.node('marketingLocation', 'MarketingLocation', {
                                active: true,
                                id: input.marketingLocationId
                            }),
                        ])
                            .match([
                            cypher_query_builder_1.node('privateLocation', 'PrivateLocation', {
                                active: true,
                                id: input.privateLocationId
                            }),
                        ]);
                        if (input.fundingAccountId) {
                            query.match([
                                cypher_query_builder_1.node('fundingAccount', 'FundingAccount', {
                                    active: true,
                                    id: input.fundingAccountId
                                }),
                            ]);
                        }
                        if (input.registryOfGeographyId) {
                            query.match([
                                cypher_query_builder_1.node('registryOfGeography', 'RegistryOfGeography', {
                                    active: true,
                                    id: input.registryOfGeographyId
                                }),
                            ]);
                        }
                        if (input.projectId) {
                            query.match([
                                cypher_query_builder_1.node('project', 'Project', {
                                    active: true,
                                    id: input.projectId
                                }),
                            ]);
                        }
                        query
                            .call(core_1.createBaseNode, ['PublicLocation'], [], {
                            owningOrgId: session.owningOrgId
                        })
                            .create([
                            [
                                cypher_query_builder_1.node('node'),
                                cypher_query_builder_1.relation('out', '', 'fieldRegion', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('fieldRegion'),
                            ],
                        ])
                            .create([
                            [
                                cypher_query_builder_1.node('node'),
                                cypher_query_builder_1.relation('out', '', 'marketingLocation', {
                                    active: true,
                                    createdAt: createdAt
                                }),
                                cypher_query_builder_1.node('marketingLocation'),
                            ],
                        ])
                            .create([
                            [
                                cypher_query_builder_1.node('node'),
                                cypher_query_builder_1.relation('out', '', 'privateLocation', { active: true, createdAt: createdAt }),
                                cypher_query_builder_1.node('privateLocation'),
                            ],
                        ]);
                        if (input.fundingAccountId) {
                            query.create([
                                [
                                    cypher_query_builder_1.node('node'),
                                    cypher_query_builder_1.relation('out', '', 'fundingAccount', { active: true, createdAt: createdAt }),
                                    cypher_query_builder_1.node('fundingAccount'),
                                ],
                            ]);
                        }
                        if (input.registryOfGeographyId) {
                            query.create([
                                [
                                    cypher_query_builder_1.node('node'),
                                    cypher_query_builder_1.relation('out', '', 'registryOfGeography', {
                                        active: true,
                                        createdAt: createdAt
                                    }),
                                    cypher_query_builder_1.node('registryOfGeography'),
                                ],
                            ]);
                        }
                        if (input.projectId) {
                            query.create([
                                [
                                    cypher_query_builder_1.node('node'),
                                    cypher_query_builder_1.relation('in', '', 'locations', { active: true, createdAt: createdAt }),
                                    cypher_query_builder_1.node('project'),
                                ],
                            ]);
                        }
                        query
                            .create(__spreadArrays(this.permission('marketingLocation', 'node'), this.permission('privateLocation', 'node'), this.permission('fundingAccount', 'node'), this.permission('registryOfGeography', 'node'), this.permission('project', 'node')))
                            .call(core_1.addUserToSG, 'rootUser', 'adminSG')
                            .call(core_1.addUserToSG, 'rootUser', 'readerSG')["return"]('node.id as id');
                        return [4 /*yield*/, query.first()];
                    case 2:
                        result = _a.sent();
                        if (!result) {
                            throw new common_1.InternalServerErrorException('failed to create a public location');
                        }
                        id = result.id;
                        // add root admin to new public location as an admin
                        return [4 /*yield*/, this.db.addRootAdminToBaseNodeAsAdmin(id, 'PublicLocation')];
                    case 3:
                        // add root admin to new public location as an admin
                        _a.sent();
                        this.logger.info("public location created", { id: result.id });
                        return [4 /*yield*/, this.readOnePublicLocation(result.id, session)];
                    case 4: return [2 /*return*/, _a.sent()];
                    case 5:
                        err_1 = _a.sent();
                        this.logger.error("Could not create public location for user " + session.userId);
                        throw new common_1.InternalServerErrorException('Could not create public location');
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.createPrivateLocation = function (input, session) {
        return __awaiter(this, void 0, Promise, function () {
            var checkPrivateLocation, secureProps, query, result, id, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.db
                            .query()
                            .match([cypher_query_builder_1.node('PrivateLocation', 'LanguageName', { value: input.name })])["return"]('PrivateLocation')
                            .first()];
                    case 1:
                        checkPrivateLocation = _a.sent();
                        if (checkPrivateLocation) {
                            throw new common_2.DuplicateException('privateLocation.name', 'PrivateLocation with this name already exists.');
                        }
                        secureProps = [
                            {
                                key: 'name',
                                value: input.name,
                                addToAdminSg: true,
                                addToWriterSg: false,
                                addToReaderSg: true,
                                isPublic: false,
                                isOrgPublic: false,
                                label: 'LanguageName'
                            },
                            {
                                key: 'publicName',
                                value: input.publicName,
                                addToAdminSg: true,
                                addToWriterSg: false,
                                addToReaderSg: true,
                                isPublic: false,
                                isOrgPublic: false,
                                label: 'LanguagePublicName'
                            },
                            {
                                key: 'type',
                                value: input.type,
                                addToAdminSg: true,
                                addToWriterSg: false,
                                addToReaderSg: true,
                                isPublic: false,
                                isOrgPublic: false,
                                label: 'PrivateLocationType'
                            },
                            {
                                key: 'sensitivity',
                                value: input.sensitivity,
                                addToAdminSg: true,
                                addToWriterSg: false,
                                addToReaderSg: true,
                                isPublic: false,
                                isOrgPublic: false
                            },
                        ];
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 6, , 7]);
                        query = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .match([
                            cypher_query_builder_1.node('rootUser', 'User', {
                                active: true,
                                id: this.config.rootAdmin.id
                            }),
                        ])
                            .call(core_1.createBaseNode, ['PrivateLocation', 'BaseNode'], secureProps, {
                            owningOrgId: session.owningOrgId
                        })
                            .call(core_1.addUserToSG, 'rootUser', 'adminSG')
                            .call(core_1.addUserToSG, 'rootUser', 'readerSG')["return"]('node.id as id');
                        return [4 /*yield*/, query.first()];
                    case 3:
                        result = _a.sent();
                        if (!result) {
                            throw new common_1.InternalServerErrorException('failed to create a private location');
                        }
                        id = result.id;
                        // add root admin to new private location as an admin
                        return [4 /*yield*/, this.db.addRootAdminToBaseNodeAsAdmin(id, 'PrivateLocation')];
                    case 4:
                        // add root admin to new private location as an admin
                        _a.sent();
                        this.logger.info("private location created", { id: result.id });
                        return [4 /*yield*/, this.readOnePrivateLocation(result.id, session)];
                    case 5: return [2 /*return*/, _a.sent()];
                    case 6:
                        err_2 = _a.sent();
                        this.logger.error("Could not create private location for user " + session.userId);
                        throw new common_1.InternalServerErrorException('Could not create private location');
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.readOne = function (id, session) {
        return __awaiter(this, void 0, Promise, function () {
            var query, results, label;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        query = "\n    MATCH (place {id: $id, active: true}) RETURN labels(place) as labels\n    ";
                        return [4 /*yield*/, this.db.query().raw(query, { id: id }).first()];
                    case 1:
                        results = _a.sent();
                        label = lodash_1.first(lodash_1.intersection(results === null || results === void 0 ? void 0 : results.labels, ['FieldRegion', 'FieldZone']));
                        this.logger.info('Looking for ', {
                            label: label,
                            id: id,
                            userId: session.userId
                        });
                        switch (label) {
                            case 'FieldZone': {
                                return [2 /*return*/, this.readOneZone(id, session)];
                            }
                            case 'FieldRegion': {
                                return [2 /*return*/, this.readOneRegion(id, session)];
                            }
                            default: {
                                throw new common_1.BadRequestException('Not a location');
                            }
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.readOneZone = function (id, session) {
        return __awaiter(this, void 0, Promise, function () {
            var query, result, secured;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.info("Read Zone", { id: id, userId: session.userId });
                        if (!id) {
                            throw new common_1.NotFoundException('no id given');
                        }
                        if (!session.userId) {
                            session.userId = this.config.anonUser.id;
                        }
                        query = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .match([cypher_query_builder_1.node('node', 'Zone', { active: true, id: id })])
                            .optionalMatch([
                            cypher_query_builder_1.node('requestingUser'),
                            cypher_query_builder_1.relation('in', '', 'member*1..'),
                            cypher_query_builder_1.node('', 'SecurityGroup', { active: true }),
                            cypher_query_builder_1.relation('out', '', 'permission'),
                            cypher_query_builder_1.node('perms', 'Permission', { active: true }),
                            cypher_query_builder_1.relation('out', '', 'baseNode'),
                            cypher_query_builder_1.node('node'),
                        ])["with"]('collect(distinct perms) as permList, node')
                            .match([
                            cypher_query_builder_1.node('node'),
                            cypher_query_builder_1.relation('out', 'r', { active: true }),
                            cypher_query_builder_1.node('props', 'Property', { active: true }),
                        ])["with"]('{value: props.value, property: type(r)} as prop, permList, node')["with"]('collect(prop) as propList, permList, node')
                            .optionalMatch([
                            cypher_query_builder_1.node('node'),
                            cypher_query_builder_1.relation('out', '', 'director', { active: true }),
                            cypher_query_builder_1.node('director', 'User', { active: true }),
                        ])["return"]('propList, permList, node, director.id as directorId')
                            .asResult();
                        return [4 /*yield*/, query.first()];
                    case 1:
                        result = _a.sent();
                        if (!result) {
                            this.logger.error("Could not find zone");
                            throw new common_1.NotFoundException('Could not find zone', 'zone.id');
                        }
                        secured = results_1.parseSecuredProperties(result.propList, result.permList, {
                            name: true,
                            director: true
                        });
                        return [2 /*return*/, __assign(__assign(__assign({}, results_1.parseBaseNodeProperties(result.node)), secured), { director: __assign(__assign({}, secured.director), { value: result.directorId }) })];
                }
            });
        });
    };
    LocationService.prototype.readOneRegion = function (id, session) {
        return __awaiter(this, void 0, Promise, function () {
            var query, result, secured;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.logger.info("Read Region", { id: id, userId: session.userId });
                        if (!id) {
                            throw new common_1.NotFoundException('no id given');
                        }
                        if (!session.userId) {
                            session.userId = this.config.anonUser.id;
                        }
                        query = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .match([cypher_query_builder_1.node('node', 'Region', { active: true, id: id })])
                            .optionalMatch([
                            cypher_query_builder_1.node('requestingUser'),
                            cypher_query_builder_1.relation('in', '', 'member*1..'),
                            cypher_query_builder_1.node('', 'SecurityGroup', { active: true }),
                            cypher_query_builder_1.relation('out', '', 'permission'),
                            cypher_query_builder_1.node('perms', 'Permission', { active: true }),
                            cypher_query_builder_1.relation('out', '', 'baseNode'),
                            cypher_query_builder_1.node('node'),
                        ])["with"]('collect(distinct perms) as permList, node')
                            .match([
                            cypher_query_builder_1.node('node'),
                            cypher_query_builder_1.relation('out', 'r', { active: true }),
                            cypher_query_builder_1.node('props', 'Property', { active: true }),
                        ])["with"]('{value: props.value, property: type(r)} as prop, permList, node')["with"]('collect(prop) as propList, permList, node')
                            .optionalMatch([
                            cypher_query_builder_1.node('node'),
                            cypher_query_builder_1.relation('out', '', 'director', { active: true }),
                            cypher_query_builder_1.node('director', 'User', { active: true }),
                        ])
                            .optionalMatch([
                            cypher_query_builder_1.node('node'),
                            cypher_query_builder_1.relation('out', '', 'zone', { active: true }),
                            cypher_query_builder_1.node('zone', 'Zone', { active: true }),
                        ])["return"]([
                            'propList, permList, node',
                            'director.id as directorId',
                            'zone.id as zoneId',
                        ])
                            .asResult();
                        return [4 /*yield*/, query.first()];
                    case 1:
                        result = _a.sent();
                        if (!result) {
                            this.logger.error("Could not find region");
                            throw new common_1.NotFoundException('Could not find region', 'region.id');
                        }
                        secured = results_1.parseSecuredProperties(result.propList, result.permList, {
                            name: true,
                            director: true,
                            zone: true
                        });
                        return [2 /*return*/, __assign(__assign(__assign({}, results_1.parseBaseNodeProperties(result.node)), secured), { director: __assign(__assign({}, secured.director), { value: result.directorId }), zone: __assign(__assign({}, secured.zone), { value: result.zoneId }) })];
                }
            });
        });
    };
    LocationService.prototype.readOneCountry = function (id, session) {
        return __awaiter(this, void 0, Promise, function () {
            var props, baseNodeMetaProps, childBaseNodeMetaProps, query, result, response, _a, _b, _c;
            var _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        this.logger.info("Query readOne Country", { id: id, userId: session.userId });
                        if (!id) {
                            throw new common_1.BadRequestException('No country id to search for');
                        }
                        props = ['name'];
                        baseNodeMetaProps = ['id', 'createdAt'];
                        childBaseNodeMetaProps = [
                            {
                                parentBaseNodePropertyKey: 'region',
                                parentRelationDirection: 'out',
                                childBaseNodeLabel: 'FieldRegion',
                                childBaseNodeMetaPropertyKey: 'id',
                                returnIdentifier: 'regionId'
                            },
                        ];
                        query = (_d = (_e = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .call(core_1.matchUserPermissions, 'Country', id)).call.apply(_e, __spreadArrays([core_1.addAllSecureProperties], props))).call.apply(_d, __spreadArrays([core_1.addAllMetaPropertiesOfChildBaseNodes], childBaseNodeMetaProps))["with"](__spreadArrays(props.map(core_1.addPropertyCoalesceWithClause), childBaseNodeMetaProps.map(core_1.addShapeForChildBaseNodeMetaProperty), baseNodeMetaProps.map(core_1.addShapeForBaseNodeMetaProperty), [
                            'node',
                            'coalesce(regionReadPerm.read, false) as canReadRegion',
                            'coalesce(regionEditPerm.edit, false) as canEditRegion',
                        ]))
                            .returnDistinct(__spreadArrays(props, baseNodeMetaProps, childBaseNodeMetaProps.map(function (x) { return x.returnIdentifier; }), [
                            'canReadRegion',
                            'canEditRegion',
                            'labels(node) as labels',
                        ]));
                        return [4 /*yield*/, query.first()];
                    case 1:
                        result = _f.sent();
                        if (!result) {
                            this.logger.error("Could not find country");
                            throw new common_1.NotFoundException('Could not find country');
                        }
                        _a = [__assign({}, result)];
                        _b = {};
                        _c = {};
                        return [4 /*yield*/, this.readOneRegion(result.regionId, session)];
                    case 2:
                        response = __assign.apply(void 0, _a.concat([(_b.region = (_c.value = _f.sent(),
                                _c.canRead = !!result.canReadRegion,
                                _c.canEdit = !!result.canEditRegion,
                                _c), _b)]));
                        return [2 /*return*/, response];
                }
            });
        });
    };
    LocationService.prototype.readOnePublicLocation = function (id, session) {
        return __awaiter(this, void 0, Promise, function () {
            var baseNodeMetaProps, childBaseNodeMetaProps, query, result, response, _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
            var _l;
            return __generator(this, function (_m) {
                switch (_m.label) {
                    case 0:
                        this.logger.info("Query readOne PublicLocation", {
                            id: id,
                            userId: session.userId
                        });
                        baseNodeMetaProps = ['id', 'createdAt'];
                        childBaseNodeMetaProps = [
                            {
                                parentBaseNodePropertyKey: 'fieldRegion',
                                parentRelationDirection: 'out',
                                childBaseNodeLabel: 'FieldRegion',
                                childBaseNodeMetaPropertyKey: 'id',
                                returnIdentifier: 'fieldRegionId'
                            },
                            {
                                parentBaseNodePropertyKey: 'marketingLocation',
                                parentRelationDirection: 'out',
                                childBaseNodeLabel: 'MarketingLocation',
                                childBaseNodeMetaPropertyKey: 'id',
                                returnIdentifier: 'marketingLocationId'
                            },
                            {
                                parentBaseNodePropertyKey: 'privateLocation',
                                parentRelationDirection: 'out',
                                childBaseNodeLabel: 'PrivateLocation',
                                childBaseNodeMetaPropertyKey: 'id',
                                returnIdentifier: 'privateLocationId'
                            },
                            {
                                parentBaseNodePropertyKey: 'registryOfGeography',
                                parentRelationDirection: 'out',
                                childBaseNodeLabel: 'RegistryOfGeography',
                                childBaseNodeMetaPropertyKey: 'id',
                                returnIdentifier: 'registryOfGeographyId'
                            },
                            {
                                parentBaseNodePropertyKey: 'project',
                                parentRelationDirection: 'in',
                                childBaseNodeLabel: 'Project',
                                childBaseNodeMetaPropertyKey: 'id',
                                returnIdentifier: 'projectId'
                            },
                        ];
                        query = (_l = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .call(core_1.matchUserPermissions, 'PublicLocation', id)).call.apply(_l, __spreadArrays([core_1.addAllMetaPropertiesOfChildBaseNodes], childBaseNodeMetaProps))["with"](__spreadArrays(childBaseNodeMetaProps.map(core_1.addShapeForChildBaseNodeMetaProperty), baseNodeMetaProps.map(core_1.addShapeForBaseNodeMetaProperty), [
                            "\n        {\n          value: fieldRegion.id,\n          canRead: coalesce(fieldRegionReadPerm.read, false),\n          canEdit: coalesce(fieldRegionEditPerm.edit, false)\n        } as fieldRegion\n        ",
                            "\n        {\n          value: marketingLocation.id,\n          canRead: coalesce(marketingLocationReadPerm.read, false),\n          canEdit: coalesce(marketingLocationEditPerm.edit, false)\n        } as marketingLocation\n        ",
                            "\n        {\n          value: registryOfGeography.id,\n          canRead: coalesce(registryOfGeographyReadPerm.read, false),\n          canEdit: coalesce(registryOfGeographyEditPerm.edit, false)\n        } as registryOfGeography\n        ",
                            "\n        {\n          value: privateLocation.id,\n          canRead: coalesce(privateLocationReadPerm.read, false),\n          canEdit: coalesce(privateLocationEditPerm.edit, false)\n        } as privateLocation\n        ",
                            "\n        {\n          value: project.id,\n          canRead: coalesce(projectReadPerm.read, false),\n          canEdit: coalesce(projectEditPerm.edit, false)\n        } as project\n        ",
                            'node',
                        ]))
                            .returnDistinct(__spreadArrays(baseNodeMetaProps, childBaseNodeMetaProps.map(function (x) { return x.returnIdentifier; }), [
                            'fundingAccount',
                            'marketingLocation',
                            'registryOfGeography',
                            'privateLocation',
                            'project',
                            'labels(node) as labels',
                        ]));
                        return [4 /*yield*/, query.first()];
                    case 1:
                        result = _m.sent();
                        if (!result) {
                            this.logger.error("Could not public location");
                            throw new common_1.NotFoundException('Could not public location');
                        }
                        _a = [__assign({}, result)];
                        _b = {};
                        _c = {
                            canRead: !!result.fundingAccount.canRead,
                            canEdit: !!result.fundingAccount.canEdit
                        };
                        if (!result.fundingAccount.value) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.fundingAccountService.readOne(result.fundingAccount.value, session)];
                    case 2:
                        _d = _m.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        _d = null;
                        _m.label = 4;
                    case 4:
                        _b.fundingAccount = (_c.value = _d,
                            _c);
                        _e = {
                            canRead: !!result.marketingLocation.canRead,
                            canEdit: !!result.marketingLocation.canEdit
                        };
                        return [4 /*yield*/, this.marketingLocationService.readOne(result.marketingLocation.value, session)];
                    case 5:
                        _b.marketingLocation = (_e.value = _m.sent(),
                            _e);
                        _f = {
                            canRead: !!result.registryOfGeography.canRead,
                            canEdit: !!result.registryOfGeography.canEdit
                        };
                        if (!result.registryOfGeography.value) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.registryOfGeographyService.readOne(result.registryOfGeography.value, session)];
                    case 6:
                        _g = _m.sent();
                        return [3 /*break*/, 8];
                    case 7:
                        _g = null;
                        _m.label = 8;
                    case 8:
                        _b.registryOfGeography = (_f.value = _g,
                            _f);
                        _h = {
                            canRead: !!result.privateLocation.canRead,
                            canEdit: !!result.privateLocation.canEdit
                        };
                        return [4 /*yield*/, this.readOnePrivateLocation(result.privateLocation.value, session)];
                    case 9:
                        _b.privateLocation = (_h.value = _m.sent(),
                            _h);
                        _j = {
                            canRead: !!result.project.canRead,
                            canEdit: !!result.project.canEdit
                        };
                        if (!result.project.value) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.projectService.readOne(result.project.value, session)];
                    case 10:
                        _k = _m.sent();
                        return [3 /*break*/, 12];
                    case 11:
                        _k = null;
                        _m.label = 12;
                    case 12:
                        response = __assign.apply(void 0, _a.concat([(_b.project = (_j.value = _k,
                                _j), _b)]));
                        return [2 /*return*/, response];
                }
            });
        });
    };
    LocationService.prototype.readOnePrivateLocation = function (id, session) {
        return __awaiter(this, void 0, Promise, function () {
            var secureProps, readPrivateLocation, result, response;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!session.userId) {
                            session.userId = this.config.anonUser.id;
                        }
                        secureProps = ['name', 'publicName', 'type', 'sensitivity'];
                        readPrivateLocation = (_a = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .call(core_1.matchUserPermissions, 'PrivateLocation', id)).call.apply(_a, __spreadArrays([core_1.addAllSecureProperties], secureProps))["with"](__spreadArrays(secureProps.map(core_1.addPropertyCoalesceWithClause), [
                            'coalesce(node.id) as id',
                            'coalesce(node.createdAt) as createdAt',
                        ]))
                            .returnDistinct(__spreadArrays(secureProps, ['id', 'createdAt']));
                        return [4 /*yield*/, readPrivateLocation.first()];
                    case 1:
                        result = _b.sent();
                        if (!result) {
                            throw new common_1.NotFoundException('Could not find private location');
                        }
                        response = __assign(__assign({}, result), { sensitivity: result.sensitivity.value || common_2.Sensitivity.Low, type: result.type.value });
                        return [2 /*return*/, response];
                }
            });
        });
    };
    LocationService.prototype.updateZone = function (input, session) {
        return __awaiter(this, void 0, Promise, function () {
            var zone, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.readOneZone(input.id, session)];
                    case 1:
                        zone = _a.sent();
                        if (!(input.directorId && input.directorId !== zone.director.value)) return [3 /*break*/, 3];
                        query = "\n        MATCH\n          (token:Token {\n            active: true,\n            value: $token\n          })<-[:token {active: true}]-\n          (requestingUser:User {\n            active: true,\n            id: $requestingUserId,\n            owningOrgId: $owningOrgId\n          }),\n          (newDirector:User {id: $directorId, active: true}),\n          (zone:FieldZone {id: $id, active: true})-[rel:director {active: true}]->(oldDirector:User)\n        DELETE rel\n        CREATE (newDirector)<-[:director {active: true, createdAt: datetime()}]-(zone)\n        RETURN  zone.id as id\n      ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                directorId: input.directorId,
                                id: input.id,
                                owningOrgId: session.owningOrgId,
                                requestingUserId: session.userId,
                                token: session.token,
                                userId: session.userId
                            })
                                .first()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [4 /*yield*/, this.db.sgUpdateProperties({
                            session: session,
                            object: zone,
                            props: ['name'],
                            changes: input,
                            nodevar: 'fieldZone'
                        })];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, this.readOneZone(input.id, session)];
                    case 5: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LocationService.prototype.updateRegion = function (input, session) {
        return __awaiter(this, void 0, Promise, function () {
            var region, query, query;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.readOneRegion(input.id, session)];
                    case 1:
                        region = _a.sent();
                        if (!(input.directorId && input.directorId !== region.director.value)) return [3 /*break*/, 3];
                        query = "\n          MATCH\n            (token:Token {\n              active: true,\n              value: $token\n            })<-[:token {active: true}]-\n            (requestingUser:User {\n              active: true,\n              id: $requestingUserId,\n              owningOrgId: $owningOrgId\n            }),\n            (newDirector:User {id: $directorId, active: true}),\n            (region:FieldRegion {id: $id, active: true})-[rel:director {active: true}]->(oldDirector:User)\n          DELETE rel\n          CREATE (newDirector)<-[:director {active: true, createdAt: datetime()}]-(region)\n          RETURN  region.id as id\n        ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                directorId: input.directorId,
                                id: input.id,
                                owningOrgId: session.owningOrgId,
                                requestingUserId: session.userId,
                                token: session.token,
                                userId: session.userId
                            })
                                .first()];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3:
                        if (!(input.zoneId && input.zoneId !== region.zone.value)) return [3 /*break*/, 5];
                        query = "\n          MATCH\n            (token:Token {\n              active: true,\n              value: $token\n            })<-[:token {active: true}]-\n            (requestingUser:User {\n              active: true,\n              id: $requestingUserId,\n              owningOrgId: $owningOrgId\n            }),\n            (newZone:FieldZone {id: $zoneId, active: true}),\n            (region:FieldRegion {id: $id, active: true})-[rel:zone {active: true}]->(oldZone:FieldZone)\n          DELETE rel\n          CREATE (newZone)<-[:zone {active: true, createdAt: datetime()}]-(region)\n          RETURN  region.id as id\n        ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                directorId: input.directorId,
                                id: input.id,
                                owningOrgId: session.owningOrgId,
                                requestingUserId: session.userId,
                                token: session.token,
                                userId: session.userId,
                                zoneId: input.zoneId
                            })
                                .first()];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [4 /*yield*/, this.db.sgUpdateProperties({
                            session: session,
                            object: region,
                            props: ['name'],
                            changes: input,
                            nodevar: 'fieldRegion'
                        })];
                    case 6:
                        _a.sent();
                        return [4 /*yield*/, this.readOneRegion(input.id, session)];
                    case 7: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    LocationService.prototype.updateCountry = function (input, session) {
        var _a;
        return __awaiter(this, void 0, Promise, function () {
            var country, query;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.readOneCountry(input.id, session)];
                    case 1:
                        country = _b.sent();
                        if (!(input.regionId && input.regionId !== ((_a = country.region.value) === null || _a === void 0 ? void 0 : _a.id))) return [3 /*break*/, 3];
                        query = "\n          MATCH\n            (token:Token {\n              active: true,\n              value: $token\n            })<-[:token {active: true}]-\n            (requestingUser:User {\n              active: true,\n              id: $requestingUserId,\n              owningOrgId: $owningOrgId\n            }),\n            (newRegion:FieldRegion {id: $regionId, active: true}),\n            (country:Country {id: $id, active: true})-[rel:region {active: true}]->(oldZone:FieldRegion)\n          DELETE rel\n          CREATE (newRegion)<-[:region {active: true, createdAt: datetime()}]-(country)\n          RETURN  country.id as id\n        ";
                        return [4 /*yield*/, this.db
                                .query()
                                .raw(query, {
                                id: input.id,
                                owningOrgId: session.owningOrgId,
                                regionId: input.regionId,
                                requestingUserId: session.userId,
                                token: session.token,
                                userId: session.userId
                            })
                                .first()];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [4 /*yield*/, this.db.sgUpdateProperties({
                            session: session,
                            object: country,
                            props: ['name'],
                            changes: input,
                            nodevar: 'country'
                        })];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, this.readOneCountry(input.id, session)];
                    case 5: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    LocationService.prototype.updatePrivateLocation = function (input, session) {
        return __awaiter(this, void 0, Promise, function () {
            var PrivateLocation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.readOnePrivateLocation(input.id, session)];
                    case 1:
                        PrivateLocation = _a.sent();
                        return [2 /*return*/, this.db.sgUpdateProperties({
                                session: session,
                                object: PrivateLocation,
                                props: ['name', 'publicName'],
                                changes: input,
                                nodevar: 'PrivateLocation'
                            })];
                }
            });
        });
    };
    LocationService.prototype["delete"] = function (id, session) {
        return __awaiter(this, void 0, Promise, function () {
            var e_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this.db
                                .query()
                                .raw("\n        MATCH\n        (token:Token {\n          active: true,\n          value: $token\n        })\n        <-[:token {active: true}]-\n        (requestingUser:User {\n          active: true,\n          id: $requestingUserId,\n          canDeleteLocation: true\n        }),\n        (place {\n          active: true,\n          id: $id\n        })\n        SET\n          place.active = false\n        RETURN\n          place.id as id\n        ", {
                                id: id,
                                owningOrgId: session.owningOrgId,
                                requestingUserId: session.userId,
                                token: session.token
                            })
                                .run()];
                    case 1:
                        _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        e_6 = _a.sent();
                        this.logger.error('Could not delete location', { exception: e_6 });
                        throw new common_1.InternalServerErrorException('Could not delete location');
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    LocationService.prototype.list = function (_a, session) {
        var _b;
        var filter = _a.filter, input = __rest(_a, ["filter"]);
        return __awaiter(this, void 0, Promise, function () {
            var types, query, result, items;
            var _this = this;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        types = (_b = filter.types) !== null && _b !== void 0 ? _b : ['Zone', 'Region'];
                        query = this.db
                            .query()
                            .call(core_1.matchRequestingUser, session)
                            .match([
                            cypher_query_builder_1.node('requestingUser'),
                            cypher_query_builder_1.relation('in', '', 'member', {}, [1]),
                            cypher_query_builder_1.node('', 'SecurityGroup', { active: true }),
                            cypher_query_builder_1.relation('out', '', 'permission'),
                            cypher_query_builder_1.node('perms', 'Permission', { active: true }),
                            cypher_query_builder_1.relation('out', '', 'baseNode'),
                            cypher_query_builder_1.node('location', { active: true }),
                        ])
                            .match([
                            cypher_query_builder_1.node('name', ['Property', 'LocationName']),
                            cypher_query_builder_1.relation('in', '', 'name'),
                            cypher_query_builder_1.node('location'),
                        ])["with"]('name, location, head([x IN labels(location) WHERE x <> "BaseNode"]) as label')
                            .where(__assign(__assign({}, (filter.name
                            ? { name: { value: cypher_query_builder_1.regexp(".*" + filter.name + ".*", true) } }
                            : {})), { label: cypher_query_builder_1.inArray(types) }))["with"]("{\n        id: location.id,\n        createdAt: location.createdAt,\n        name: name.value\n      } as node");
                        return [4 /*yield*/, core_1.runListQuery(query, input, false)];
                    case 1:
                        result = _c.sent();
                        if (!result) {
                            throw new common_1.BadRequestException('No location');
                        }
                        return [4 /*yield*/, Promise.all(result.items.map(function (row) { return _this.readOne(row.id, session); }))];
                    case 2:
                        items = _c.sent();
                        return [2 /*return*/, __assign(__assign({}, result), { items: items })];
                }
            });
        });
    };
    // private randomLocation() {
    //   const id = () => faker.random.alphaNumeric(8);
    //   const inPast = () => DateTime.fromJSDate(faker.date.past());
    //   const ro = <T>(value: T) => ({
    //     value,
    //     canRead: true,
    //     canEdit: false,
    //   });
    //   const user = (): User => ({
    //     id: id(),
    //     createdAt: inPast(),
    //     bio: ro(''),
    //     displayFirstName: ro(faker.name.firstName()),
    //     displayLastName: ro(faker.name.lastName()),
    //     realFirstName: ro(faker.name.firstName()),
    //     realLastName: ro(faker.name.lastName()),
    //     email: ro(faker.internet.email()),
    //     phone: ro(faker.phone.phoneNumber()),
    //     timezone: ro(faker.lorem.words(2)),
    //   });
    //   const region: Zone = {
    //     id: id(),
    //     createdAt: inPast(),
    //     name: ro(faker.address.country()),
    //     director: ro(user()),
    //   };
    //   const area: Region = {
    //     id: id(),
    //     createdAt: inPast(),
    //     name: ro(faker.address.state()),
    //     zone: ro(region),
    //     director: ro(user()),
    //   };
    //   const country: Country = {
    //     id: id(),
    //     createdAt: inPast(),
    //     name: ro(faker.address.city()),
    //     region: ro(area),
    //   };
    //   return faker.random.arrayElement([area, region, country]);
    // }
    LocationService.prototype.checkZoneConsistency = function (session) {
        return __awaiter(this, void 0, Promise, function () {
            var zones, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.db
                            .query()
                            .match([
                            core_1.matchSession(session),
                            [
                                cypher_query_builder_1.node('zone', 'Zone', {
                                    active: true
                                }),
                            ],
                        ])["return"]('zone.id as id')
                            .run()];
                    case 1:
                        zones = _b.sent();
                        return [4 /*yield*/, Promise.all(zones.map(function (zone) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.db.isRelationshipUnique({
                                                session: session,
                                                id: zone.id,
                                                relName: 'director',
                                                srcNodeLabel: 'Zone'
                                            })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a = (_b.sent()).every(function (n) { return n; });
                        if (!_a) return [3 /*break*/, 4];
                        return [4 /*yield*/, Promise.all(zones.map(function (zone) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.db.hasProperties({
                                                session: session,
                                                id: zone.id,
                                                props: ['name'],
                                                nodevar: 'zone'
                                            })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }))];
                    case 3:
                        _a = (_b.sent()).every(function (n) { return n; });
                        _b.label = 4;
                    case 4: return [2 /*return*/, (_a)];
                }
            });
        });
    };
    LocationService.prototype.checkRegionConsistency = function (session) {
        return __awaiter(this, void 0, Promise, function () {
            var regions, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.db
                            .query()
                            .match([
                            core_1.matchSession(session),
                            [
                                cypher_query_builder_1.node('region', 'Region', {
                                    active: true
                                }),
                            ],
                        ])["return"]('region.id as id')
                            .run()];
                    case 1:
                        regions = _b.sent();
                        return [4 /*yield*/, Promise.all(regions.map(function (region) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.db.isRelationshipUnique({
                                                session: session,
                                                id: region.id,
                                                relName: 'zone',
                                                srcNodeLabel: 'Region'
                                            })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a = (_b.sent()).every(function (n) { return n; });
                        if (!_a) return [3 /*break*/, 4];
                        return [4 /*yield*/, Promise.all(regions.map(function (region) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.db.hasProperties({
                                                session: session,
                                                id: region.id,
                                                props: ['name'],
                                                nodevar: 'region'
                                            })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }))];
                    case 3:
                        _a = (_b.sent()).every(function (n) { return n; });
                        _b.label = 4;
                    case 4: return [2 /*return*/, (_a)];
                }
            });
        });
    };
    LocationService.prototype.checkCountryConsistency = function (session) {
        return __awaiter(this, void 0, Promise, function () {
            var countries, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.db
                            .query()
                            .match([
                            core_1.matchSession(session),
                            [
                                cypher_query_builder_1.node('country', 'Country', {
                                    active: true
                                }),
                            ],
                        ])["return"]('country.id as id')
                            .run()];
                    case 1:
                        countries = _b.sent();
                        return [4 /*yield*/, Promise.all(countries.map(function (country) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.db.isRelationshipUnique({
                                                session: session,
                                                id: country.id,
                                                relName: 'region',
                                                srcNodeLabel: 'Country'
                                            })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a = (_b.sent()).every(function (n) { return n; });
                        if (!_a) return [3 /*break*/, 4];
                        return [4 /*yield*/, Promise.all(countries.map(function (country) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.db.hasProperties({
                                                session: session,
                                                id: country.id,
                                                props: ['name'],
                                                nodevar: 'country'
                                            })];
                                        case 1: return [2 /*return*/, _a.sent()];
                                    }
                                });
                            }); }))];
                    case 3:
                        _a = (_b.sent()).every(function (n) { return n; });
                        _b.label = 4;
                    case 4: return [2 /*return*/, (_a)];
                }
            });
        });
    };
    LocationService.prototype.checkLocationConsistency = function (session) {
        return __awaiter(this, void 0, Promise, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.checkCountryConsistency(session)];
                    case 1:
                        _b = (_c.sent());
                        if (!_b) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.checkRegionConsistency(session)];
                    case 2:
                        _b = (_c.sent());
                        _c.label = 3;
                    case 3:
                        _a = _b;
                        if (!_a) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.checkZoneConsistency(session)];
                    case 4:
                        _a = (_c.sent());
                        _c.label = 5;
                    case 5: return [2 /*return*/, (_a)];
                }
            });
        });
    };
    __decorate([
        core_1.OnIndex()
    ], LocationService.prototype, "createIndexes");
    LocationService = __decorate([
        common_1.Injectable(),
        __param(0, core_1.Logger('location:service')),
        __param(5, common_1.Inject(common_1.forwardRef(function () { return ProjectService; })))
    ], LocationService);
    return LocationService;
}());
exports.LocationService = LocationService;
