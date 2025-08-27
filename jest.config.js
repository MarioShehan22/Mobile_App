module.exports = {
    preset: 'jest-expo',
    testMatch: ['**/__tests__/**/*.(test|spec).(ts|tsx)'],
    setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    moduleNameMapper: {
        // Asset & style mocks
        '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/__mocks__/fileMock.js',
        '\\.(css|less|scss)$': '<rootDir>/__mocks__/styleMock.js',
        // Optional: your tsconfig alias like @/*
        '^@/(.*)$': '<rootDir>/$1',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(jest-)?react-native|@react-native|react-clone-referenced-element|@react-navigation|@react-native-community|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|expo-modules-core|react-native-svg)',
    ],
    testEnvironment: 'jsdom',
};
