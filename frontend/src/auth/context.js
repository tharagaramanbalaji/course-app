import { createContext } from "react";

/** Kept apart from the provider so the provider file exports only components. */
export const AuthContext = createContext(null);
