import ts, { factory } from 'typescript';
import fs from 'fs-extra';
import path from 'path';
import parseCsv from 'csv-parse/lib/sync';
import camelcase from 'camelcase';
import { JSDOM } from 'jsdom';

process.on('unhandledRejection', e => {throw e;});

interface EnumData {
  name: string;
  value: number | string;
  comment?: string;
}

const uaSchemaPath = path.join(__dirname, '..', 'schema');
const srcPath = path.join(__dirname, '..', 'src');

void(main());
async function main () {
  console.log('Generating AttributeIds');
  await createAttributeIds();

  console.log('Generating NodeIds');
  await createNodeIds();

  console.log('Generating ServerCapabilities');
  await createServerCapabilities();

  console.log('Generating StatusCode');
  await createStatusCode();
  
  console.log('Generating OpcUaTypes');
  await createTypes();
}

async function createAttributeIds() {
  const fileContent = await fs.readFile(path.join(uaSchemaPath, 'AttributeIds.csv'), 'utf8');
  const data = (parseCsv(fileContent) as string[][]).map(row => ({
    name: row[0] as string,
    value: parseInt(row[1] as string)
  }));
  await printNodes(path.join(srcPath, 'DataTypes', 'AttributeIds.ts'), createEnum('AttributeIds', data));
}

async function createNodeIds() {
  const fileContent = await fs.readFile(path.join(uaSchemaPath, 'NodeIds.csv'), 'utf8');
  const data = (parseCsv(fileContent) as string[][]).map(row => ({
    name: row[0] as string,
    value: parseInt(row[1] as string)
  }));
  await printNodes(path.join(srcPath, 'DataTypes', 'NodeIds.ts'), createEnum('NodeIds', data));
}

async function createServerCapabilities() {
  const fileContent = await fs.readFile(path.join(uaSchemaPath, 'ServerCapabilities.csv'), 'utf8');
  const data = (parseCsv(fileContent) as string[][]).map(row => ({
    name: row[0] as string,
    value: row[0] as string,
    comment: row[1] as string
  }));
  await printNodes(path.join(srcPath, 'DataTypes', 'ServerCapabilities.ts'), createEnum('ServerCapabilities', data));
}

async function createStatusCode() {
  const fileContent = await fs.readFile(path.join(uaSchemaPath, 'StatusCode.csv'), 'utf8');
  const csvData = parseCsv(fileContent) as string[][];
  const data = csvData.map(row => ({
    name: row[0] as string,
    code: row[1] as string,
    description: row[2] as string
  }));

  const out: string[] = [''];

  for (const row of data) {
    out.push(`/** ${row.description} */`);
    out.push(`static ${row.name} = new StatusCode({name: "${row.name}", code: ${row.code}, description: "${row.description}"});`);
  }

  for (const row of data) {
    out.push(`static ${row.code} = StatusCode.${row.name};`);
  }

  await printText(path.join(srcPath, 'DataTypes', 'StatusCode.gen'), out.join('\n'));
}

async function createTypes(): Promise<void> {
  const fileContent = await fs.readFile(path.join(uaSchemaPath, 'Opc.Ua.Types.bsd'), 'utf8');
  const doc = parseXmlDocument(fileContent);
  const nodes: ts.Node[] = [];

  const enumeratedTypeNames = Array.from(doc.documentElement.children)
    .filter(c => c.tagName === 'opc:EnumeratedType')
    .map(elm => elm.getAttribute('Name') ?? '');

  for (const elm of Array.from(doc.documentElement.children)) {
    switch (elm.tagName) {
      case 'opc:EnumeratedType': {
        createEnumeratedType(elm);
        break;
      }
      case 'opc:StructuredType': {
        createStructuredType(elm);
        break;
      }
    }
  }

  function createEnumeratedType(elm: Element): void {
    const name = elm.getAttribute('Name') ?? '';
    const enumeratedValues = Array.from(elm.children).filter(c => c.tagName === 'opc:EnumeratedValue');

    const members = enumeratedValues.map((ev): EnumData => {
      return {
        name: ev.getAttribute('Name') ?? '',
        value: parseInt(ev.getAttribute('Value') ?? '')
      };
    });

    nodes.push(createEnum(name, members));
  }

  function createStructuredType(elm: Element): void {
    const name = elm.getAttribute('Name') ?? '';
    switch (name) {
      case 'DataValue':
      case 'DiagnosticInfo':
      case 'ExpandedNodeId':
      case 'ExtensionObject':
      case 'LocalizedText':
      case 'NodeId':
      case 'TwoByteNodeId':
      case 'FourByteNodeId':
      case 'NumericNodeId':
      case 'StringNodeId':
      case 'GuidNodeId':
      case 'ByteStringNodeId':
      case 'QualifiedName':
      case 'Variant':
      case 'XmlElement':
      case 'ServiceFault':
        return;
    }
    const fields = getFieldData();
    const nonComputedFields = fields.filter(field => !field.isLengthFieldFor);

    const members: ts.ClassElement[] = createProperties();

    if (nonComputedFields.length) {
      nodes.push(createOptionsInterface());
      members.push(createConstructor());
    }

    members.push(createTypeIdProperty());
    members.push(createEncodeFunction());
    members.push(createDecodeFunction());

    const node = factory.createClassDeclaration(
      undefined,
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      name,
      undefined,
      nonComputedFields.length ? [factory.createHeritageClause(
        ts.SyntaxKind.ImplementsKeyword,
        [factory.createExpressionWithTypeArguments(
          factory.createIdentifier(`${name}Options`),
          undefined
        )]
      )] : undefined,
      members
    );
    
    nodes.push(node);

    function getFieldData() {
      const _fields = Array.from(elm.children).filter(c => c.tagName === 'opc:Field');

      const fields = _fields.map(field => {
        const name = field.getAttribute('Name') ?? '';
        const typeName = field.getAttribute('TypeName') ?? undefined;
        let mappedTypeName = mapTypeName(typeName);
        const nullable = mappedTypeName === 'UaString' || mappedTypeName === 'ByteString' || mappedTypeName === 'XmlElement';
        const lengthField = field.getAttribute('LengthField') ?? undefined;

      
        if (lengthField) {
          mappedTypeName = `ReadonlyArray<${mappedTypeName}>`;
        }
        
        const defaultValue = mapDefaultValue(mappedTypeName);

        const isLengthFieldFor = _fields.find(elm => elm.getAttribute('LengthField') === name)?.getAttribute('Name');

        return {
          name,
          propertyName: camelcase(name),
          typeName,
          mappedTypeName,
          nullable: nullable || lengthField,
          defaultValue,
          lengthField,
          isLengthFieldFor: isLengthFieldFor ? camelcase(isLengthFieldFor) : undefined
        };
      });
      return fields;
    }

    function mapTypeName(typeName?: string): string {
      typeName = typeName?.split(':')[1];
      switch (typeName) {
        case 'Boolean':
          return 'boolean';
        case 'String':
          return 'UaString';
        case 'DateTime':
          return 'Date';
        case '':
        case undefined:
          return 'unknown';
        default:
          return typeName;
      }
    }

    function mapDefaultValue(mappedTypeName: string): ts.Expression {
      if (enumeratedTypeNames.includes(mappedTypeName)) {
        const enumeratedType = Array.from(doc.documentElement.children).find(t => t.getAttribute('Name') === mappedTypeName) as Element;
        const firstMember = Array.from(enumeratedType.children).find(c => c.tagName === 'opc:EnumeratedValue') as Element;

        return factory.createPropertyAccessExpression(
          factory.createIdentifier(mappedTypeName),
          factory.createIdentifier(firstMember.getAttribute('Name') || '')
        );
      }
      switch (mappedTypeName) {
        case 'boolean':
          return factory.createFalse();
        case 'SByte':
        case 'Byte':
        case 'Int16':
        case 'UInt16':
        case 'Int32':
        case 'UInt32':
        case 'Float':
        case 'Double':
          return factory.createNumericLiteral(0);
        case 'StatusCode':
          return factory.createPropertyAccessExpression(
            factory.createIdentifier('StatusCode'),
            factory.createIdentifier('Good')
          );
        case 'Int64':
        case 'UInt64':
          return factory.createCallExpression(
            factory.createIdentifier('BigInt'),
            undefined,
            [factory.createNumericLiteral(0)]
          );
        case 'Date':
          return factory.createNewExpression(
            factory.createIdentifier('Date'),
            undefined,
            [factory.createPrefixUnaryExpression(
              ts.SyntaxKind.MinusToken,
              factory.createNumericLiteral(11644473600000)
            )]
          );
        case 'NodeId':
        case 'Variant':
          return factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(mappedTypeName),
              factory.createIdentifier('null')
            ),
            undefined,
            []
          );
        default:
          return factory.createNewExpression(
            factory.createIdentifier(mappedTypeName),
            undefined,
            []
          );
      }
    }

    function createProperties(): ts.PropertyDeclaration[] {
      return nonComputedFields.map((field) => {
        return factory.createPropertyDeclaration(
          undefined,
          [factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)],
          field.propertyName,
          field.nullable ? factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
          factory.createTypeReferenceNode(field.mappedTypeName),
          undefined
        );
      });
    }

    function createTypeIdProperty(): ts.PropertyDeclaration {
      return factory.createPropertyDeclaration(
        undefined,
        [factory.createModifier(ts.SyntaxKind.StaticKeyword)],
        factory.createComputedPropertyName(factory.createIdentifier('typeId')),
        undefined,
        undefined,
        factory.createAsExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier('NodeIds'),
            factory.createIdentifier(`${name}_Encoding_DefaultBinary`)
          ),
          factory.createTypeReferenceNode(
            factory.createIdentifier("const"),
            undefined
          )
        )
      );
    }

    function createOptionsInterface(): ts.InterfaceDeclaration {
      const interfaceMembers = nonComputedFields.map(field => {
        return factory.createPropertySignature(
          [],
          factory.createIdentifier(field.propertyName),
          factory.createToken(ts.SyntaxKind.QuestionToken),
          factory.createUnionTypeNode([
            factory.createTypeReferenceNode(field.mappedTypeName),
            factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
          ])
        );
      });

      return factory.createInterfaceDeclaration(
        undefined,
        [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        `${name}Options`,
        undefined,
        undefined,
        interfaceMembers
      );
    }

    function createConstructor(): ts.ConstructorDeclaration {
      const constructorAssignments = nonComputedFields.map(field => {
        let expression: ts.Expression;
        if (field.nullable) {
          expression = factory.createPropertyAccessChain(
            factory.createIdentifier('options'),
            factory.createToken(ts.SyntaxKind.QuestionDotToken),
            factory.createIdentifier(field.propertyName)
          );
        } else {
          expression = factory.createBinaryExpression(
            factory.createPropertyAccessChain(
              factory.createIdentifier('options'),
              factory.createToken(ts.SyntaxKind.QuestionDotToken),
              factory.createIdentifier(field.propertyName)
            ),
            factory.createToken(ts.SyntaxKind.QuestionQuestionToken),
            field.defaultValue
          );
        }

        return factory.createExpressionStatement(factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createThis(),
            factory.createIdentifier(field.propertyName)
          ),
          factory.createToken(ts.SyntaxKind.EqualsToken),
          expression
        ));
      });

      const constructorDeclaration = factory.createConstructorDeclaration(
        undefined,
        undefined,
        [factory.createParameterDeclaration(
          undefined,
          undefined,
          undefined,
          factory.createIdentifier('options'),
          factory.createToken(ts.SyntaxKind.QuestionToken),
          factory.createTypeReferenceNode(`${name}Options`),
          undefined
        )],
        factory.createBlock(
          constructorAssignments,
          true
        )
      );

      return constructorDeclaration;
    }

    function createEncodeFunction(): ts.MethodDeclaration {
      const statements = nonComputedFields.map(field => {
        const encoderFn = 'write' + mapEncoderDecoderFunction(field.mappedTypeName);
        
        return factory.createExpressionStatement(factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier('encoder'),
            factory.createIdentifier(encoderFn)
          ),
          undefined,
          [factory.createPropertyAccessExpression(factory.createThis(), field.propertyName)]
        ));
      });

      return factory.createMethodDeclaration(
        undefined,
        undefined,
        undefined,
        factory.createComputedPropertyName(factory.createIdentifier('encode')),
        undefined,
        undefined,
        [factory.createParameterDeclaration(
          undefined,
          undefined,
          undefined,
          'encoder',
          undefined,
          factory.createTypeReferenceNode('BinaryDataEncoder')
        )],
        factory.createToken(ts.SyntaxKind.VoidKeyword),
        factory.createBlock(
          statements,
          true
        )
      );
    }

    function createDecodeFunction(): ts.MethodDeclaration {
      const constructorParameters: ts.ObjectLiteralExpression[] = [];
      if (nonComputedFields.length) {
        constructorParameters.push(
          factory.createObjectLiteralExpression(
            nonComputedFields.map(field => {
              const decoderFn = 'read' + mapEncoderDecoderFunction(field.mappedTypeName);

              const readFunctionParameters: ts.Expression[] = [];
              if (decoderFn.startsWith('readType')) {
                const isArray = field.mappedTypeName.startsWith('ReadonlyArray');
                const mappedTypeName = isArray ? field.mappedTypeName.substring(14, field.mappedTypeName.length - 1) : field.mappedTypeName;
                readFunctionParameters.push(factory.createIdentifier(mappedTypeName));
              }

              const expr = factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier('decoder'),
                  factory.createIdentifier(decoderFn)
                ),
                undefined,
                readFunctionParameters
              );
              return factory.createPropertyAssignment(field.propertyName, expr);
            }),
            true
          )
        );
      }

      return factory.createMethodDeclaration(
        undefined,
        [ factory.createModifier(ts.SyntaxKind.StaticKeyword) ],
        undefined,
        factory.createComputedPropertyName(factory.createIdentifier('decode')),
        undefined,
        undefined,
        [factory.createParameterDeclaration(
          undefined,
          undefined,
          undefined,
          'decoder',
          undefined,
          factory.createTypeReferenceNode('BinaryDataDecoder')
        )],
        factory.createTypeReferenceNode(name),
        factory.createBlock(
          [
            factory.createReturnStatement(factory.createNewExpression(
              factory.createIdentifier(name),
              undefined,
              constructorParameters
            ))
          ],
          true
        )
      );
    }

    function mapEncoderDecoderFunction(mappedTypeName: string): string {
      const isArray = mappedTypeName.startsWith('ReadonlyArray');
      mappedTypeName = isArray ? mappedTypeName.substring(14, mappedTypeName.length - 1) : mappedTypeName;

      let fn: string;
      switch (mappedTypeName) {
        case 'SByte':
        case 'Byte': 
        case 'Int16':
        case 'UInt16':
        case 'Int32':
        case 'UInt32':
        case 'Int64':
        case 'UInt64':
        case 'Float':
        case 'Double':
        case 'ByteString':
        case 'XmlElement': {
          fn = mappedTypeName;
          break;
        }
        case 'UaString': {
          fn = 'String';
          break;
        }
        case 'boolean': {
          fn = 'Boolean';
          break;
        }
        case 'Date': {
          fn = 'DateTime';
          break;
        }
        default: {
          if (enumeratedTypeNames.includes(mappedTypeName)) {
            fn = 'UInt32';
            break;
          }
          fn = 'Type';
          break;
        }
      }

      if (isArray) {
        return fn + 'Array';
      }
      return fn;
    }
  }
  
  const header = 
`/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { DataValue } from './DataValue';
import { DiagnosticInfo } from './DiagnosticInfo';
import { ExpandedNodeId } from './ExpandedNodeId';
import { ExtensionObject } from './ExtensionObject';
import { Guid } from './Guid';
import { LocalizedText } from './LocalizedText';
import { NodeId } from './NodeId';
import { NodeIds } from './NodeIds';
import { QualifiedName } from './QualifiedName';
import { Variant } from './Variant';
import { StatusCode } from './StatusCode';
import {
  SByte,
  Byte,
  Int16,
  UInt16,
  Int32,
  UInt32,
  Int64,
  Float,
  Double,
  UaString,
  ByteString
} from './Primitives';
import { BinaryDataEncoder, BinaryDataDecoder } from '../BinaryDataEncoding';
import { decode, encode, typeId } from '../symbols';
`;

  await printNodes(path.join(srcPath, 'DataTypes', 'Generated.ts'), nodes, header);
}

function createEnum(name: string, members: EnumData[]): ts.EnumDeclaration {
  const enumMembers = members.map(({name, value, comment}) => {
    let literal: ts.Expression;
    if (typeof value === 'number') {
      literal = factory.createNumericLiteral(value);
    } else {
      literal = factory.createStringLiteral(value, true);
    }

    if (/^\d/.test(name)) {
      name = '_' + name;
    }

    const enumMember = factory.createEnumMember(name, literal);

    if (comment) {
      ts.addSyntheticLeadingComment(enumMember, ts.SyntaxKind.MultiLineCommentTrivia, '*' + comment, true);
    }

    return enumMember;
  });  

  const enumDeclaration = factory.createEnumDeclaration(
    undefined,
    [factory.createToken(ts.SyntaxKind.ExportKeyword)],
    name,
    enumMembers
  );

  return enumDeclaration;
}

async function printNodes(filename: string, nodes: ts.Node | ts.Node[], prefix?: string) {
  const resultFile = ts.createSourceFile(filename, '', ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  let result: string;
  if (Array.isArray(nodes)) {
    result = printer.printList(ts.ListFormat.MultiLine, factory.createNodeArray(nodes), resultFile);
  } else {
    result = printer.printNode(ts.EmitHint.Unspecified, nodes, resultFile);
  }
  
  await printText(filename, (prefix ?? '') + result);
}

async function printText(filename: string, text: string) {
  text = '// Autogenerated\n' + text;
  await fs.ensureFile(filename);
  await fs.writeFile(filename, text);
}

function parseXmlDocument(text: string): Document {
  const { window } = new JSDOM('');

  const doc = new window.DOMParser().parseFromString(text, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) {
    throw new Error('Failed to parse XML document: ' + (error.textContent || ''));
  }
  return doc;
}