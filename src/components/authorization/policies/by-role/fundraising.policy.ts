import { member, Policy, Role, sensMediumOrLower } from '../util';

// NOTE: There could be other permissions for this role from other policies
@Policy(Role.Fundraising, (r) => [
  r.EthnologueLanguage.whenAny(member, sensMediumOrLower).read,
  r.Language.read.specifically((p) => [
    p.registryOfDialectsCode.whenAny(member, sensMediumOrLower).read,
    p.signLanguageCode.whenAny(member, sensMediumOrLower).read,
    p.locations.whenAny(member, sensMediumOrLower).read,
  ]),
  r.Organization.whenAny(sensMediumOrLower).read.specifically((p) => [
    //TODO - this none can be removed when policy executor is refactored to check for address.none in parent policy
    p.address.none,
    p.locations.read,
  ]),
  r.Partner.when(sensMediumOrLower)
    .read.when(member)
    .read.specifically((p) => p.many('pmcEntityCode', 'pointOfContact').none)
    .children((c) => c.posts.edit),
  r.Partnership.specifically((p) => [
    // TODO this is same as above (when combined with the Investor Common Policy). Inherit single relation perms automatically. Only read action I guess
    p.many('organization', 'partner').whenAny(member, sensMediumOrLower).read,
  ]),
  r.Project.specifically((p) => [
    p
      .many('rootDirectory', 'primaryLocation', 'otherLocations')
      .whenAny(member, sensMediumOrLower).read,
  ]).children((c) => c.posts.when(member).edit),
])
export class FundraisingPolicy {}
