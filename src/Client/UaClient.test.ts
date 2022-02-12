import { AttributeIds } from '../DataTypes/AttributeIds.js';
import {
  BrowseDescription,
  BrowsePath,
  BrowseRequest,
  BrowseResultMask,
  CreateMonitoredItemsRequest,
  CreateSubscriptionRequest,
  MonitoredItemCreateRequest,
  MonitoringMode,
  MonitoringParameters,
  ReadRequest,
  ReadValueId,
  RelativePath,
  RelativePathElement,
  TranslateBrowsePathsToNodeIdsRequest
} from '../DataTypes/Generated.js';
import { NodeId } from '../DataTypes/NodeId.js';
import { NodeIds } from '../DataTypes/NodeIds.js';
import { QualifiedName } from '../DataTypes/QualifiedName.js';
import { UaClient } from './UaClient.js';

const endpointUrl = 'opc.tcp://localhost:4840';
//const endpointUrl = 'opc.ws://localhost:8080';

const testFn = process.env.CI ? test.skip : test;

testFn('Connect TCP', async () => {
  const client = new UaClient({
    endpointUrl: endpointUrl
  });

  await client.connect();
  await client.closeSessionAndDisconnect();
}, 20_000);

testFn('Disconnect event', async () => {
  const client = new UaClient({
    endpointUrl: endpointUrl
  });

  let eventFired = 0;
  client.on('disconnected', () => eventFired++);

  await client.connect();
  await client.closeSessionAndDisconnect();

  expect(eventFired).toBe(1);
}, 20_000);

testFn('TranslateBrowsePathsToNodeIds', async () => {
  const client = new UaClient({
    endpointUrl: endpointUrl
  });

  await client.connect();

  const response = await client.translateBrowsePathsToNodeIds(new TranslateBrowsePathsToNodeIdsRequest({
    browsePaths: [
      new BrowsePath({
        startingNode: NodeId.parse(NodeIds.Server),
        relativePath: new RelativePath({
          elements: [
            new RelativePathElement({
              referenceTypeId: NodeId.parse(NodeIds.HasComponent),
              targetName: new QualifiedName({
                namespaceIndex: 0,
                name: 'ServerStatus'
              })
            }),
            new RelativePathElement({
              referenceTypeId: NodeId.parse(NodeIds.HasComponent),
              targetName: new QualifiedName({
                namespaceIndex: 0,
                name: 'StartTime'
              })
            })
          ]
        })
      })
    ]
  }));
  
  await client.closeSessionAndDisconnect();

  expect(response.results?.[0]?.targets?.[0]?.targetId.nodeId.value).toBe(NodeIds.Server_ServerStatus_StartTime);
}, 20_000);

testFn('Browse', async () => {
  const client = new UaClient({
    endpointUrl: endpointUrl
  });

  await client.connect();

  const response = await client.browse(new BrowseRequest({
    nodesToBrowse: [
      new BrowseDescription({
        nodeId: NodeId.parse(NodeIds.Server_ServerStatus),
        resultMask: BrowseResultMask.All
      })
    ]
  }));

  await client.closeSessionAndDisconnect();

  expect(response.results?.[0]?.references?.find(r => r.nodeId.nodeId.value === NodeIds.Server_ServerStatus_StartTime)).toBeDefined();
}, 20_000);

testFn('Read', async () => {
  const client = new UaClient({
    endpointUrl: endpointUrl
  });

  await client.connect();

  const response = await client.read(new ReadRequest({
    nodesToRead: [
      new ReadValueId({
        nodeId: NodeId.parse(NodeIds.Server_ServerStatus_BuildInfo_ProductName),
        attributeId: AttributeIds.Value
      })
    ]
  }));

  await client.closeSessionAndDisconnect();

  expect(response.results?.[0]?.value?.value).toBe('open62541 OPC UA Server');
}, 20_000);

testFn('MonitoredItem', async () => {
  const client = new UaClient({
    endpointUrl: endpointUrl
  });

  await client.connect();

  const subscription = await client.createSubscription(new CreateSubscriptionRequest({
    publishingEnabled: true,
    requestedPublishingInterval: 500,
    requestedLifetimeCount: 60,
    requestedMaxKeepAliveCount: 10
  }));

  const startDate = new Date();

  const monitoredItems = await subscription.createMonitoredItems(new CreateMonitoredItemsRequest({
    itemsToCreate: [
      new MonitoredItemCreateRequest({
        monitoringMode: MonitoringMode.Reporting,
        requestedParameters: new MonitoringParameters({
          samplingInterval: -1
        }),
        itemToMonitor: new ReadValueId({
          nodeId: NodeId.parse(NodeIds.Server_ServerStatus_CurrentTime),
          attributeId: AttributeIds.Value
        })
      })
    ]
  }));

  let value: Date | undefined;

  monitoredItems[0]?.on('value', dataValue => {
    value = dataValue.value?.value as Date;
  });

  await new Promise(resolve => setTimeout(resolve, 5000));

  expect(value?.valueOf()).toBeGreaterThanOrEqual(startDate.valueOf());

  await client.closeSessionAndDisconnect();
}, 20_000);