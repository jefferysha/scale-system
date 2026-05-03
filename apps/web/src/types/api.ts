import type { components, paths } from '@scale/shared-types';

export type schemas = components['schemas'];

export type Project = schemas['ProjectOut'];
export type ProjectCreate = schemas['ProjectCreate'];
export type ProjectUpdate = schemas['ProjectUpdate'];

export type Vertical = schemas['VerticalOut'];
export type VerticalCreate = schemas['VerticalCreate'];
export type VerticalUpdate = schemas['VerticalUpdate'];

export type Scale = schemas['ScaleOut'];
export type ScaleCreate = schemas['ScaleCreate'];
export type ScaleUpdate = schemas['ScaleUpdate'];
export type ScaleValidateResult = schemas['ScaleValidateResult'];
export type ScaleProbeReport = schemas['ScaleProbeReport'];
export type ScaleProbeAck = schemas['ScaleProbeAck'];

export type Cup = schemas['CupOut'];
export type CupCreate = schemas['CupCreate'];
export type CupUpdate = schemas['CupUpdate'];
export type CupCalibration = schemas['CupCalibrationOut'];

export type RecordItem = schemas['RecordOut'];
export type RecordCreate = schemas['RecordCreate'];
export type RecordUpdate = schemas['RecordUpdate'];
export type RecordPoint = schemas['RecordPointIn'];
export type BatchResponse = schemas['BatchResponse'];

export type CursorPageProject = schemas['CursorPage_ProjectOut_'];
export type CursorPageRecord = schemas['CursorPage_RecordOut_'];
export type OffsetPageCup = schemas['OffsetPage_CupOut_'];

export type { paths };
