import {
    Field,
    prop,
    CircuitValue,
    Signature,
    PublicKey,
    PrivateKey,
    UInt32
  } from 'snarkyjs';

  export interface Balances {
    address: PublicKey;
    balance: Field;
    ids: UInt32[];
  } 

  export interface Allowances {
    owner: PublicKey;
    spenders: PublicKey[];
  } 

  export interface Metadatas {
    id: UInt32;
    uri: string;
  }


export class Bytes extends CircuitValue {
    value: String;
    
    constructor(value: String) {
        super();
        this.value = value;
    }
  }
  
  export class SignatureWithSigner extends CircuitValue {
    @prop signature: Signature;
    @prop signer: PublicKey;
  
    constructor(signature: Signature, signer: PublicKey) {
      super();
      this.signature = signature;
      this.signer = signer;
    }
  
    static create(signer: PrivateKey, message: Field[]): SignatureWithSigner {
      return new SignatureWithSigner(
        Signature.create(signer, message),
        signer.toPublicKey()
      );
    }
  }