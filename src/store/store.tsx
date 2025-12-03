//Zustand Imports
import { createStore } from 'zustand/vanilla';
import { FolderNode, PropertyNode, Property } from "./types";

export type State = {
  fileTree: FolderNode[] | null;
  propertyList: Property;
};

export type Actions = {
  createFileTree: (fileTree: FolderNode[] | null) => void;
  addPropertyList: (property: Property) => void;
  updatePropertyNode: (propertyPath: string, propertyLabel: string, status: 'valid' | 'falsified' | 'undetermined' | 'unchecked', time: number, cex?: object) => void;
  getPropertyNode: (propertyLabel: string) => PropertyNode | null;
  getFirstPropertyNode: () => PropertyNode | null;
};

const useStore = createStore<State & Actions>((set, get) => ({
    fileTree: null,
    propertyList: {},

    createFileTree: (fileTree: FolderNode[] | null) => {
      set({ fileTree });
    },

    addPropertyList: (property: Property) => {
      set((state) => ({
        propertyList: {
          ...state.propertyList,
          ...property,
        },
      }));
    },

    updatePropertyNode: (propertyPath: string, propertyLabel: string, status: 'valid' | 'falsified' | 'undetermined' | 'unchecked', time: number, cex?: object) => {
      set((state) => {
        if (!state.fileTree) return state;

        const updateFolder = (folder: FolderNode): FolderNode => ({
          ...folder,
          children: folder.children.map(child => {
            if (child.type === 'folder') {
              return updateFolder(child);
            } else if (child.type === 'file' && child.path === propertyPath) {
              return {
                ...child,
                children: child.children.map(prop => 
                  prop.label === propertyLabel 
                    ? { ...prop, status, time, cex } 
                    : prop
                )
              };
            }
            return child;
          })
        });

        return {
          fileTree: state.fileTree.map(updateFolder)
        };
      });
    },

    getPropertyNode: (propertyLabel: string) => {
      const { fileTree } = get();
      if (!fileTree) return null;

      let foundNode: PropertyNode | null = null;

      const searchFolder = (folder: FolderNode) => {
        for (const child of folder.children) {
          if (child.type === 'folder') {
            searchFolder(child);
          } else if (child.type === 'file') {
            for (const prop of child.children) {
              if (prop.label === propertyLabel) {
                foundNode = prop;
                return;
              }
            }
          }
        }
      };

      for (const folder of fileTree) {
        searchFolder(folder);
        if (foundNode) break;
      }

      return foundNode;
    },

    getFirstPropertyNode: () => {
      const { fileTree } = get();
      if (!fileTree) return null;

      for (const folder of fileTree) {
        const searchFolder = (folder: FolderNode): PropertyNode | null => {
          for (const child of folder.children) {
            if (child.type === 'folder') {
              const result = searchFolder(child);
              if (result) return result;
            } else if (child.type === 'file' && child.children.length > 0) {
              return child.children[0];
            }
          }
          return null;
        };

        const result = searchFolder(folder);
        if (result) return result;
      }

      return null;
    }

}));  

export default useStore;