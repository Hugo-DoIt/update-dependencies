export type File = {
  remote: string;
  local: string;
};

export type Dependency = {
  name: string;
  version: string;
  files: File[];
};

export type Dependencies = {
  localBasePath: string;
  dependencies: Dependency[];
};
