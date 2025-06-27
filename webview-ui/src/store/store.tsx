//Zustand Imports
import { create } from "zustand";

export type State = {
  currentUser: string;
};

export type Actions = {
  changeActiveUser: (user: string) => void;
};

const useStore = create<State & Actions>((set) => ({
    currentUser: 'Astrid',

    changeActiveUser: (user: string) => {
      set({ currentUser: user });
    },
}));  

export default useStore;