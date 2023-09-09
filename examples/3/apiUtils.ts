const generateId = () => {
  return Math.random().toString(36).substring(2, 9);
};

const buildMockApiObject = (name: string, description: string): ApiObject => {
  return {
    id: generateId(),
    description,
  };
};
