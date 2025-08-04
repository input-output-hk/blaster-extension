//Zustand Imports
import { createStore } from 'zustand/vanilla';
import { FolderNode } from "./types";

export type State = {
  fileTree: FolderNode[] | null;
};

export type Actions = {
  createFileTree: (fileTree: FolderNode[] | null) => void;
};

const useStore = createStore<State & Actions>((set) => ({
    fileTree: null,

    createFileTree: (fileTree: FolderNode[] | null) => {
      set({ fileTree });
    },
}));  

export default useStore;