"use server";

import {
  addByAmount as addByAmountAction,
  adjustBalance as adjustBalanceAction,
  adjustQuantity as adjustQuantityAction,
  updatePrice as updatePriceAction,
} from "./valuation-actions";
import {
  recordDividend as recordDividendAction,
  recordInterest as recordInterestAction,
  sellQuantity as sellQuantityAction,
} from "./trade-actions";
import {
  archiveAccount as archiveAccountAction,
  deleteAccount as deleteAccountAction,
  unarchiveAccount as unarchiveAccountAction,
} from "./lifecycle-actions";
import {
  createRecurringPlan as createRecurringPlanAction,
  deletePlan as deletePlanAction,
  togglePlan as togglePlanAction,
} from "./recurring-plan-actions";
import type { FormState } from "./action-shared";

export type { FormState } from "./action-shared";

export async function updatePrice(previous: FormState, formData: FormData) {
  return updatePriceAction(previous, formData);
}

export async function adjustQuantity(previous: FormState, formData: FormData) {
  return adjustQuantityAction(previous, formData);
}

export async function addByAmount(previous: FormState, formData: FormData) {
  return addByAmountAction(previous, formData);
}

export async function adjustBalance(previous: FormState, formData: FormData) {
  return adjustBalanceAction(previous, formData);
}

export async function sellQuantity(previous: FormState, formData: FormData) {
  return sellQuantityAction(previous, formData);
}

export async function recordDividend(previous: FormState, formData: FormData) {
  return recordDividendAction(previous, formData);
}

export async function recordInterest(previous: FormState, formData: FormData) {
  return recordInterestAction(previous, formData);
}

export async function archiveAccount(previous: FormState, formData: FormData) {
  return archiveAccountAction(previous, formData);
}

export async function unarchiveAccount(previous: FormState, formData: FormData) {
  return unarchiveAccountAction(previous, formData);
}

export async function deleteAccount(previous: FormState, formData: FormData) {
  return deleteAccountAction(previous, formData);
}

export async function createRecurringPlan(
  previous: FormState,
  formData: FormData,
) {
  return createRecurringPlanAction(previous, formData);
}

export async function togglePlan(previous: FormState, formData: FormData) {
  return togglePlanAction(previous, formData);
}

export async function deletePlan(previous: FormState, formData: FormData) {
  return deletePlanAction(previous, formData);
}
