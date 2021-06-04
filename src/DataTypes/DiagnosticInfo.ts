import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { decode, encode, typeId } from '../symbols';
import { isUInt32 } from '../util';
import { NodeIds } from './NodeIds';
import { Int32, UaString } from './Primitives';
import { StatusCode } from './StatusCode';

const symbolicIdMask = 0x01;
const namespaceMask = 0x02;
const localizedTextMask = 0x04;
const localeMask = 0x08;
const additionalInfoMask = 0x10;
const innerStatusCodeMask = 0x20;
const innerDiagnosticInfoMask = 0x40;

export interface DiagnosticInfoOptions {
  /** A symbolic name for the status code. */
  symbolicId?: Int32;
  /** A namespace that qualifies the symbolic id. */
  namespaceUri?: Int32;
  /** The locale used for the localized text. */
  locale?: Int32;
  /** A human readable summary of the status code. */
  localizedText?: Int32;
  /** Detailed application specific diagnostic information. */
  additionalInfo?: UaString;
  /** A status code provided by an underlying system. */
  innerStatusCode?: StatusCode;
  /** Diagnostic info associated with the inner status code. */
  innerDiagnosticInfo?: DiagnosticInfo;
}

/** A recursive structure containing diagnostic information associated with a status code. */
export class DiagnosticInfo implements DiagnosticInfoOptions {
  /** A symbolic name for the status code. */
  symbolicId?: Int32;
  /** A namespace that qualifies the symbolic id. */
  namespaceUri?: Int32;
  /** The locale used for the localized text. */
  locale?: Int32;
  /** A human readable summary of the status code. */
  localizedText?: Int32;
  /** Detailed application specific diagnostic information. */
  additionalInfo?: UaString;
  /** A status code provided by an underlying system. */
  innerStatusCode?: StatusCode;
  /** Diagnostic info associated with the inner status code. */
  innerDiagnosticInfo?: DiagnosticInfo;
  
  constructor(options?: DiagnosticInfoOptions) {
    this.symbolicId = options?.symbolicId;
    this.namespaceUri = options?.namespaceUri;
    this.locale = options?.locale;
    this.localizedText = options?.localizedText;
    this.additionalInfo = options?.additionalInfo;
    this.innerStatusCode = options?.innerStatusCode;
    this.innerDiagnosticInfo = options?.innerDiagnosticInfo;
  }

  toString(): string {
    const str = ['DiagnosticInfo:'];

    if (this.symbolicId !== undefined) {
      let _str = this.symbolicId.toString();
      if (!isUInt32(this.symbolicId)) {
        _str += ' (Invalid)';
      }
      str.push(`  SymbolicId: ${_str}`);
    }
    if (this.namespaceUri !== undefined) {
      let _str = this.namespaceUri.toString();
      if (!isUInt32(this.namespaceUri)) {
        _str += ' (Invalid)';
      }
      str.push(`  NamespaceUri: ${_str}`);
    }
    if (this.locale !== undefined) {
      let _str = this.locale.toString();
      if (!isUInt32(this.locale)) {
        _str += ' (Invalid)';
      }
      str.push(`  Locale: ${_str}`);
    }
    if (this.localizedText !== undefined) {
      let _str = this.localizedText.toString();
      if (!isUInt32(this.localizedText)) {
        _str += ' (Invalid)';
      }
      str.push(`  LocalizedText: ${_str}`);
    }
    if (this.additionalInfo !== undefined) {
      str.push(`  AdditionalInfo: ${this.additionalInfo}`);
    }
    if (this.innerStatusCode !== undefined) {
      str.push(`  InnerStatusCode: ${this.innerStatusCode.toString()}`);
    }
    if (this.innerDiagnosticInfo !== undefined) {
      const innerStr = this.innerDiagnosticInfo.toString().split('\n').map(l => '  ' + l).join('\n');
      str.push(`  InnerDiagnosticInfo:\n${innerStr}`);
    }

    return str.join('\n');
  }

  isNull(): boolean {
    return this.symbolicId === undefined &&
    this.namespaceUri === undefined &&
    this.locale === undefined &&
    this.localizedText === undefined &&
    this.additionalInfo === undefined &&
    this.innerStatusCode === undefined &&
    this.innerDiagnosticInfo === undefined;
  }

  static [typeId] = NodeIds.DiagnosticInfo as const;

  [encode](encoder: BinaryDataEncoder): void {
    let mask = 0x00;
    if (this.symbolicId !== undefined) mask += 0x01;
    if (this.namespaceUri !== undefined) mask += 0x02;
    if (this.locale !== undefined) mask += 0x04;
    if (this.localizedText !== undefined) mask += 0x08;
    if (this.additionalInfo !== undefined) mask += 0x10;
    if (this.innerStatusCode !== undefined) mask += 0x20;
    if (this.innerDiagnosticInfo !== undefined) mask += 0x40;

    encoder.writeByte(mask);

    if (this.symbolicId !== undefined) {
      encoder.writeInt32(this.symbolicId);
    }
    if (this.namespaceUri !== undefined) {
      encoder.writeInt32(this.namespaceUri);
    }
    if (this.locale !== undefined) {
      encoder.writeInt32(this.locale);
    }
    if (this.localizedText !== undefined) {
      encoder.writeInt32(this.localizedText);
    }
    if (this.additionalInfo !== undefined) {
      encoder.writeString(this.additionalInfo);
    }
    if (this.innerStatusCode !== undefined) {
      encoder.writeType(this.innerStatusCode);
    }
    if (this.innerDiagnosticInfo !== undefined) {
      encoder.writeType(this.innerDiagnosticInfo);
    }
  }

  static [decode](decoder: BinaryDataDecoder): DiagnosticInfo {
    const mask = decoder.readByte();

    let symbolicId: Int32 | undefined;
    let namespaceUri: Int32 | undefined;
    let locale: Int32 | undefined;
    let localizedText: Int32 | undefined;
    let additionalInfo: UaString | undefined;
    let innerStatusCode: StatusCode | undefined;
    let innerDiagnosticInfo: DiagnosticInfo | undefined;

    if (symbolicIdMask & mask) {
      symbolicId = decoder.readInt32();
    }
    if (namespaceMask & mask) {
      namespaceUri = decoder.readInt32();
    }
    if (localeMask & mask) {
      locale = decoder.readInt32();
    }
    if (localizedTextMask & mask) {
      localizedText = decoder.readInt32();
    }
    if (additionalInfoMask & mask) {
      additionalInfo = decoder.readString();
    }
    if (innerStatusCodeMask & mask) {
      innerStatusCode = decoder.readType(StatusCode);
    }
    if (innerDiagnosticInfoMask & mask) {
      innerDiagnosticInfo = decoder.readType(DiagnosticInfo);
    }

    return new DiagnosticInfo({
      symbolicId,
      namespaceUri,
      locale,
      localizedText,
      additionalInfo,
      innerStatusCode,
      innerDiagnosticInfo
    });
  }
}