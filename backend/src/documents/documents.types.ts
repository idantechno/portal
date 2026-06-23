export interface BrandConfig {
  logoUrl?: string;
  primaryColor?: string;
  font?: string;
}

/**
 * Snapshot of the template + per-business config taken at instance creation
 * time. Frozen on the instance so later edits to the template or the brand
 * don't change documents that were already produced.
 */
export interface TemplateSnapshot {
  htmlTemplate: string;
  templateVersion: number;
  config: {
    boilerplate: Record<string, string>;
    brand: BrandConfig;
  };
}

export interface RecipientFields {
  signerFullName: string;
  signerId?: string;
}
