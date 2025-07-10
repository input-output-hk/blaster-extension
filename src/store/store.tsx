//Zustand Imports
import { createStore } from 'zustand/vanilla';
import { FolderNode } from "./types";

export type State = {
  fileTree: FolderNode | null;
};

export type Actions = {
  changeFileTree: (fileTree: FolderNode | null) => void;
};

const useStore = createStore<State & Actions>((set) => ({
    fileTree: null,

    changeFileTree: (fileTree: FolderNode | null) => {
      set({ fileTree });
    },
}));  

export default useStore;