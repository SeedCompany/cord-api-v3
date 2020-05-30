// graphql templates
import { generate } from 'shortid';
import { Property } from './model';

export function createPermission(
  queryId: string,
  createdAt: string,
  grantIdentifier: string,
  securityGroupId: string,
  dataHolderId: string,
  read: boolean,
  edit: boolean,
  admin: boolean
): string {
  const permId = generate();

  return `
  ${queryId}: CreatePermission(
    id: "${permId}"
    createdAt:{formatted:"${createdAt}"}
    active:true
    grantedPropertyName:"${grantIdentifier}"
    read:${read}
    edit:${edit}
    admin:${admin}
  ){
    id
  }

  # attach perm to reader sg
  ${queryId}_sg: AddSecurityGroupPermissions(from:{id:"${securityGroupId}"}, to:{id:"${permId}"}){
    from{id}
  }

  # attach perm to data holder
  ${queryId}_dh: AddPermissionGrant(from:{id:"${permId}"}, to:{id:"${dataHolderId}"}){
    from{id}
  }
  `;
}

export function addLabel(queryId: string, id: string, label: string) {
  return `
  # add label to node
  ${queryId}: addLabel(nodeId:"${id}", label:"${label}")
  `;
}

export function createData(
  queryId: string,
  createdAt: string,
  value: string,
  dataHolderId: string,
  labels?: string[]
): string {
  const dataId = generate();

  let labelQuery = '';
  let counter = 0;
  if (labels) {
    labels.forEach((label) => {
      labelQuery += addLabel(`${queryId}_label${counter++}`, dataId, label);
    });
  }
  return `
  # create data node
  ${queryId}: CreateData(
    id: "${dataId}"
    createdAt: { formatted: "${createdAt}" }
    active: true
    value: "${value}"
  ) {
    id
  }

  ${labelQuery}
  
  # attach data to data holder
  ${queryId}_dh: addDataOrBaseNodeToDataHolder(fromId:"${dataHolderId}", toId:"${dataId}")
  `;
}

export function createDataHolder(
  queryId: string,
  dataHolderId: string,
  createdAt: string,
  identifier: string,
  valueType: string,
  isSingleton: boolean,
  baseNodeId: string,
  dataQuery: string,
  adminPerm: string,
  readerPerm: string
): string {
  return `
  # create data holder
  ${queryId}: CreateDataHolder(
    id: "${dataHolderId}"
    createdAt: { formatted: "${createdAt}" }
    active: true
    identifier: "${identifier}"
    valueType: ${valueType}
    isSingleton: ${isSingleton}
  ) {
    id
  }

  ${queryId}_baseNodeDataHolders: AddBaseNodeDataHolders(from:{id:"${baseNodeId}"}, to:{id:"${dataHolderId}"}){
    from{id}
  }

  ${dataQuery}

  ${adminPerm}

  ${readerPerm}
  `;
}

export function createSecurityGroup(
  queryId: string,
  baseNodeId: string,
  sgId: string,
  createdAt: string,
  name: string
): string {
  return `
  ${queryId}: CreateSecurityGroup(
    id: "${sgId}"
    createdAt: { formatted: "${createdAt}" }
    active: true
    name: "${name}"
  ) {
    id
    
  }
  `;
}

export function addSecurityGroupMember(
  queryId: string,
  sgId: string,
  userId: string
): string {
  return `
  ${queryId}:  AddSecurityGroupMembers(
    from: { id: "${sgId}" }
    to: { id: "${userId}" }
  ) {
    from {
      id
    }
  }
  `;
}

export function createBaseNode(
  queryId: string,
  baseNodeId: string,
  createdAt: string,
  baseNodeLabel: string,
  sgAdminId: string,
  requestingUserId: string,
  sgReaderId: string,
  propQuery: string
): string {
  const labelQuery = addLabel(`${queryId}_label`, baseNodeId, baseNodeLabel);

  const adminSGQuery = createSecurityGroup(
    `${queryId}_admin_sg`,
    baseNodeId,
    sgAdminId,
    createdAt,
    `SG Admin for ${baseNodeId}`
  );

  const addAdminMember = addSecurityGroupMember(
    `${queryId}_addAdminMember`,
    sgAdminId,
    requestingUserId
  );

  const readerSGQuery = createSecurityGroup(
    `${queryId}_reader_sg`,
    baseNodeId,
    sgReaderId,
    createdAt,
    `SG Reader for ${baseNodeId}`
  );

  const addReaderMember = addSecurityGroupMember(
    `${queryId}_addReaderMember`,
    sgReaderId,
    requestingUserId
  );

  return `
  mutation{
    ${queryId}: CreateBaseNode(
      id: "${baseNodeId}"
      createdAt: { formatted: "${createdAt}"}
      active: true
    ){
      id
    }

    # add label to base node
    ${labelQuery} 

    ${adminSGQuery}

    ${addAdminMember}
  
    ${readerSGQuery}

    ${addReaderMember}

    ${propQuery}

  }
  `;
}

export function updateProperty(
  queryId: string,
  baseNodeId: string,
  requestingUserId: string,
  identifier: string,
  newValue: string,
  oldValue: string,
  isSingleton: boolean,
  labels?: string[]
): string {
  let query = '';
  const newDataId = generate();
  let counter = 0;
  let labelsQuery = '';

  if (labels) {
    labels.forEach((label) => {
      labelsQuery += addLabel(`${queryId}_label${counter++}`, newDataId, label);
    });
  }

  if (isSingleton) {
    query = `
    secureUpdateSingletonData( 
      baseNodeId:"${baseNodeId}"
      requestingUserId:"${requestingUserId}"
      identifier:"${identifier}"
      newDataId:"${newDataId}"
      newValue:"${newValue}"
    )
  
    ${labelsQuery}
  `;
  } else {
    if (oldValue) {
      query = `
      secureUpdateArrayData( 
        baseNodeId:"${baseNodeId}"
        requestingUserId:"${requestingUserId}"
        identifier:"${identifier}"
        newDataId:"${newDataId}"
        newValue:"${newValue}"
        )
        
        ${labelsQuery}
        `;
    } else {
      query = `
      secureAddArrayData( 
        baseNodeId:"${baseNodeId}"
        requestingUserId:"${requestingUserId}"
        identifier:"${identifier}"
        newDataId:"${newDataId}"
        newValue:"${newValue}"
        )
        
        ${labelsQuery}
        `;
    }
  }
  return query;
}

export function secureReadDataByBaseNodeId(
  baseNodeId: string,
  requestingUserId: string,
  identifier: string,
  isSingleton: boolean
): string {
  if (isSingleton) {
    return `
    ${identifier}: secureReadDataSingletonByBaseNodeId(
      baseNodeId: "${baseNodeId}"
      requestingUserId: "${requestingUserId}"
      identifier: "${identifier}"
    ){
      value
      canRead
      canEdit
      canAdmin
    }
  `;
  } else {
    return `
    ${identifier}: secureReadDataArrayByBaseNodeId(
      baseNodeId: "${baseNodeId}"
      requestingUserId: "${requestingUserId}"
      identifier: "${identifier}"
    ){
      value
      canRead
      canEdit
      canAdmin
    }
  `;
  }
}

export function secureDeleteData(
  queryId: string,
  baseNodeId: string,
  requestingUserId: string,
  identifier: string,
  value: string
): string {
  return `
    ${queryId}: secureDeleteData(
      baseNodeId: "${baseNodeId}"
      requestingUserId: "${requestingUserId}"
      identifier: "${identifier}"
      value: "${value}"
    )
  `;
}

export function createPower(
  queryId: string,
  powerId: string,
  createdAt: string,
  value: string
): string {
  return `
  ${queryId}: CreatePower(
    id:"${powerId}"
    createdAt:{formatted:"${createdAt}"}
    active: true
    value: "${value}"
  )
  `;
}

export function addPowerRelationship(
  queryId: string,
  sgId: string,
  powerId: string
): string {
  return `
  ${queryId}: AddSecurityGroupPowers(from:{id:"${sgId}"}, to:{id:"${powerId}"})
  `;
}

export function addAdmin(queryId: string, baseNodeId: string, userId: string) {
  return `
  ${queryId}: AddBaseNodeAdmins(from:{id:"${baseNodeId}"}, to:{id:"${userId}"})
  `;
}

export function addCreator(
  queryId: string,
  baseNodeId: string,
  userId: string
) {
  return `
    ${queryId}: AddBaseNodeCreator(from:{id:"${baseNodeId}"}, to:{id:"${userId}"})
    `;
}
