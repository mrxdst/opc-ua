import { getEndpoints } from './discovery.js';

const endpointUrl = 'opc.tcp://localhost:4840';
//const endpointUrl = 'opc.ws://localhost:8080';

const testFn = process.env.CI ? test.skip : test;

testFn('GetEndpoints', async () => {
  const response = await getEndpoints(endpointUrl);

  expect(response.endpoints?.find(e => e.securityPolicyUri === 'http://opcfoundation.org/UA/SecurityPolicy#None')).toBeDefined();
}, 20_000);