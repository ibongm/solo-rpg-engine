/**
 * Firestore data-access layer. Paths follow the blueprint schema exactly:
 * users/{uid}/characters, users/{uid}/graveyard, users/{uid}/campaigns/{cid}/{turns|diary|codex}
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config.js';
import { uid as makeId } from '../engine/rng.js';

function requireDb() {
  if (!db) throw new Error('Firebase is not configured. See SETUP.md.');
  return db;
}

// ── Paths ────────────────────────────────────────────────────────

export const charactersCol = (uid) => collection(requireDb(), 'users', uid, 'characters');
export const characterRef = (uid, id) => doc(requireDb(), 'users', uid, 'characters', id);
export const campaignsCol = (uid) => collection(requireDb(), 'users', uid, 'campaigns');
export const campaignRef = (uid, id) => doc(requireDb(), 'users', uid, 'campaigns', id);
export const turnsCol = (uid, cid) => collection(requireDb(), 'users', uid, 'campaigns', cid, 'turns');
export const turnRef = (uid, cid, tid) => doc(requireDb(), 'users', uid, 'campaigns', cid, 'turns', tid);
export const diaryCol = (uid, cid) => collection(requireDb(), 'users', uid, 'campaigns', cid, 'diary');
export const diaryRef = (uid, cid, id) => doc(requireDb(), 'users', uid, 'campaigns', cid, 'diary', id);
export const codexCol = (uid, cid) => collection(requireDb(), 'users', uid, 'campaigns', cid, 'codex');
export const codexRef = (uid, cid, id) => doc(requireDb(), 'users', uid, 'campaigns', cid, 'codex', id);
export const graveyardCol = (uid) => collection(requireDb(), 'users', uid, 'graveyard');
export const memorialRef = (uid, id) => doc(requireDb(), 'users', uid, 'graveyard', id);

const withId = (snap) => ({ id: snap.id, ...snap.data() });

/** Firestore rejects nested arrays and undefined; JSON round-trip strips undefined. */
export function clean(obj) {
  return JSON.parse(JSON.stringify(obj ?? null));
}

// ── Characters ───────────────────────────────────────────────────

export async function listCharacters(uid) {
  const snap = await getDocs(query(charactersCol(uid), orderBy('updatedAt', 'desc')));
  return snap.docs.map(withId);
}

export async function getCharacter(uid, id) {
  const snap = await getDoc(characterRef(uid, id));
  return snap.exists() ? withId(snap) : null;
}

export async function createCharacterDoc(uid, data) {
  const id = makeId('char');
  const { id: _ignored, ...rest } = data;
  await setDoc(characterRef(uid, id), clean({ ...rest, createdAt: rest.createdAt || Date.now(), updatedAt: Date.now() }));
  return id;
}

export async function updateCharacterDoc(uid, id, data) {
  const { id: _ignored, ...rest } = data;
  await setDoc(characterRef(uid, id), clean({ ...rest, updatedAt: Date.now() }));
}

export async function deleteCharacterDoc(uid, id) {
  await deleteDoc(characterRef(uid, id));
}

// ── Campaigns ────────────────────────────────────────────────────

export async function listCampaigns(uid) {
  const snap = await getDocs(campaignsCol(uid));
  return snap.docs.map(withId).sort((a, b) => (b.meta?.lastPlayedAt || 0) - (a.meta?.lastPlayedAt || 0));
}

export async function getCampaign(uid, id) {
  const snap = await getDoc(campaignRef(uid, id));
  return snap.exists() ? withId(snap) : null;
}

/**
 * Creates a campaign, its opening turn, and binds the character to it — atomically.
 */
export async function createCampaignWithOpening(uid, { campaign, openingTurn, characterId, characterPatch, codexEntries = [] }) {
  const cid = makeId('camp');
  const batch = writeBatch(requireDb());
  batch.set(campaignRef(uid, cid), clean({ ...campaign, lastTurnId: openingTurn?.id ?? null }));
  if (openingTurn) batch.set(turnRef(uid, cid, openingTurn.id), clean(openingTurn));
  for (const entry of codexEntries) {
    const id = entry.id || makeId('codex');
    batch.set(codexRef(uid, cid, id), clean({ ...entry, id, updatedAt: Date.now() }));
  }
  batch.update(characterRef(uid, characterId), clean({ ...(characterPatch || {}), activeCampaignId: cid, updatedAt: Date.now() }));
  await batch.commit();
  return cid;
}

export async function updateCampaignDoc(uid, id, patch) {
  await updateDoc(campaignRef(uid, id), clean(patch));
}

async function deleteCollection(colRef) {
  const snap = await getDocs(colRef);
  let batch = writeBatch(requireDb());
  let n = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    n++;
    if (n % 400 === 0) {
      await batch.commit();
      batch = writeBatch(requireDb());
    }
  }
  await batch.commit();
}

/** Deletes a campaign with all subcollections and frees its character. */
export async function deleteCampaignCascade(uid, campaign) {
  const cid = campaign.id;
  await deleteCollection(turnsCol(uid, cid));
  await deleteCollection(diaryCol(uid, cid));
  await deleteCollection(codexCol(uid, cid));
  await deleteDoc(campaignRef(uid, cid));
  const charId = campaign.meta?.activeCharId;
  if (charId) {
    const ch = await getCharacter(uid, charId);
    if (ch && ch.activeCampaignId === cid) await updateDoc(characterRef(uid, charId), { activeCampaignId: null, updatedAt: Date.now() });
  }
}

export async function loadCampaignSubcollections(uid, cid) {
  const [turns, diary, codex] = await Promise.all([
    getDocs(query(turnsCol(uid, cid), orderBy('index', 'asc'))),
    getDocs(query(diaryCol(uid, cid), orderBy('index', 'asc'))),
    getDocs(codexCol(uid, cid)),
  ]);
  return {
    turns: turns.docs.map(withId),
    diary: diary.docs.map(withId),
    codex: codex.docs.map(withId),
  };
}

/** Imports a native campaign bundle as a brand-new campaign + character. */
export async function importCampaignBundle(uid, { campaign, character, turns, diary, codex }) {
  const cid = makeId('camp');
  let charId = null;
  if (character) {
    charId = makeId('char');
    await setDoc(characterRef(uid, charId), clean({ ...character, activeCampaignId: campaign.meta?.status === 'active' ? cid : null, updatedAt: Date.now() }));
  }
  const meta = { ...campaign.meta, activeCharId: charId ?? campaign.meta?.activeCharId ?? null, title: `${campaign.meta?.title || 'Imported'} (Imported)`, lastPlayedAt: Date.now() };
  await setDoc(campaignRef(uid, cid), clean({ ...campaign, meta, cacheRef: null }));
  const writeAll = async (items, refFn, prefix) => {
    let batch = writeBatch(requireDb());
    let n = 0;
    for (const item of items) {
      const id = item.id || makeId(prefix);
      batch.set(refFn(uid, cid, id), clean({ ...item, id }));
      n++;
      if (n % 400 === 0) {
        await batch.commit();
        batch = writeBatch(requireDb());
      }
    }
    await batch.commit();
  };
  await writeAll(turns, turnRef, 'turn');
  await writeAll(diary, diaryRef, 'chapter');
  await writeAll(codex, codexRef, 'codex');
  return cid;
}

// ── Graveyard ────────────────────────────────────────────────────

export async function listGraveyard(uid) {
  const snap = await getDocs(graveyardCol(uid));
  return snap.docs.map(withId).sort((a, b) => (b.diedAt || 0) - (a.diedAt || 0));
}

// ── Live subscriptions ──────────────────────────────────────────

export function subscribeCampaign(uid, cid, cb, onError) {
  return onSnapshot(campaignRef(uid, cid), (snap) => cb(snap.exists() ? withId(snap) : null), onError);
}

export function subscribeCharacter(uid, id, cb, onError) {
  return onSnapshot(characterRef(uid, id), (snap) => cb(snap.exists() ? withId(snap) : null), onError);
}

export function subscribeTurns(uid, cid, cb, onError) {
  return onSnapshot(query(turnsCol(uid, cid), orderBy('index', 'asc')), (snap) => cb(snap.docs.map(withId)), onError);
}

export function subscribeDiary(uid, cid, cb, onError) {
  return onSnapshot(query(diaryCol(uid, cid), orderBy('index', 'asc')), (snap) => cb(snap.docs.map(withId)), onError);
}

export function subscribeCodex(uid, cid, cb, onError) {
  return onSnapshot(codexCol(uid, cid), (snap) => cb(snap.docs.map(withId)), onError);
}
