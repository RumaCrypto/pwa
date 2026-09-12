"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Contact } from "./contacts";

const CONTACTS_KEY = "ruma-contacts";

interface ContactsContextType {
  contacts: Contact[];
  /** False until localStorage has been read, so screens don't act on an empty list. */
  loaded: boolean;
  addContact: (contact: Omit<Contact, "id">) => Contact;
  removeContact: (id: string) => void;
  findContact: (id: string) => Contact | undefined;
}

const ContactsContext = createContext<ContactsContextType | undefined>(undefined);

function read(): Contact[] {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    return raw ? (JSON.parse(raw) as Contact[]) : [];
  } catch {
    // Corrupt or unavailable storage shouldn't take the home screen down.
    return [];
  }
}

export function ContactsProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage is unavailable until after mount. */
    setContacts(read());
    setLoaded(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }, [contacts, loaded]);

  const addContact = useCallback((contact: Omit<Contact, "id">) => {
    const created: Contact = { ...contact, id: crypto.randomUUID() };
    setContacts((current) => [...current, created]);
    return created;
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((current) => current.filter((contact) => contact.id !== id));
  }, []);

  const findContact = useCallback(
    (id: string) => contacts.find((contact) => contact.id === id),
    [contacts]
  );

  const value = useMemo(
    () => ({ contacts, loaded, addContact, removeContact, findContact }),
    [contacts, loaded, addContact, removeContact, findContact]
  );

  return <ContactsContext.Provider value={value}>{children}</ContactsContext.Provider>;
}

export function useContacts() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error("useContacts must be used within ContactsProvider");
  }
  return context;
}
