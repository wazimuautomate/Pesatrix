export type DarajaTokenResponse = {
  access_token: string;
  expires_in: string;
};

export type StkPushRequest = {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: "CustomerPayBillOnline";
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
};

export type StkPushResponse = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
};

export type StkCallbackMetadataItem = {
  Name?: string;
  Value?: unknown;
};

export type StkCallbackPayload = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: StkCallbackMetadataItem[];
      };
    };
  };
};

export type ParsedStkCallbackMetadata = {
  amount?: number;
  mpesaReceipt?: string;
  phoneNumber?: string;
  transactionDate?: string;
};

export type B2CRequest = {
  InitiatorName: string;
  SecurityCredential: string;
  CommandID: "BusinessPayment";
  Amount: number;
  PartyA: string;
  PartyB: string;
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
  Occasion: string;
};

export type B2CInitiationResponse = {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
};

export type B2CResultParameter = {
  Key?: string;
  Value?: unknown;
};

export type B2CResultPayload = {
  Result?: {
    ConversationID?: string;
    OriginatorConversationID?: string;
    ResultCode?: number;
    ResultDesc?: string;
    ResultParameters?: {
      ResultParameter?: B2CResultParameter[];
    };
    ReferenceData?: {
      ReferenceItem?: Array<{
        Key?: string;
        Value?: unknown;
      }>;
    };
  };
};

export type B2CTimeoutPayload = {
  ConversationID?: string;
  OriginatorConversationID?: string;
  ResultCode?: number;
  ResultDesc?: string;
};

export type ParsedB2CResult = {
  amount?: number;
  receipt?: string;
  receiverPartyPublicName?: string;
  transactionCompletedDateTime?: string;
  utilityAccountAvailableFunds?: string;
  workingAccountAvailableFunds?: string;
};
