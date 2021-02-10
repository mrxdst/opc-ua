import { BinaryDataDecoder, BinaryDataEncoder } from '../BinaryDataEncoding';
import { decode, encode } from '../symbols';
import { UaString } from './Primitives';

const localeMask = 0x01;
const textMask = 0x02;

export interface LocalizedTextOptions {
  /** The locale. */
  locale?: string;
  /** The text in the specified locale. */
  text?: string;
}

/** A string qualified with a namespace index. */
export class LocalizedText implements LocalizedTextOptions {
  /** The locale. */
  locale?: string;
  /** The text in the specified locale. */
  text?: string;

  constructor (options?: LocalizedTextOptions) {
    this.locale = options?.locale;
    this.text = options?.text;
  }

  toString(): string {
    const str = ['LocalizedText:'];

    if (this.locale !== undefined) {
      str.push(`  Locale: ${this.locale}`);
    }
    if (this.text !== undefined) {
      str.push(`  Text: ${this.text}`);
    }

    return str.join(`\n`);
  }

  isNull(): boolean {
    return !this.locale && !this.text;
  }

  [encode](encoder: BinaryDataEncoder): void {
    let mask = 0x00;
    if (this.locale) {
      mask += localeMask;
    }
    if (this.text) {
      mask += textMask;
    }
    encoder.writeByte(mask);

    if (this.locale) {
      encoder.writeString(this.locale);
    }
    if (this.text) {
      encoder.writeString(this.text);
    }
  }

  static [decode](decoder: BinaryDataDecoder): LocalizedText {
    const mask = decoder.readByte();

    let locale: UaString;
    let text: UaString;

    if (localeMask & mask) {
      locale = decoder.readString();
    }
    if (textMask & mask) {
      text = decoder.readString();
    }

    return new LocalizedText({locale, text});
  }
}
