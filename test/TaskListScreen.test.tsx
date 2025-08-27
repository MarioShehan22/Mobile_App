import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import TaskListScreen from '@/components/ui/screen/home/TaskListScreen';
import * as FS from 'firebase/firestore';
import {describe, it} from "node:test";
import expect from "expect";

describe('TaskListScreen', () => {
    it('renders tasks coming from onSnapshot', async () => {
        render(<TaskListScreen navigation={{ navigate: jest.fn() }} />);

        // Push a fake snapshot from our mock
        (FS as any).__pushTasksSnapshot([
            {
                id: 't1',
                title: 'Buy milk',
                dueDate: '2025-08-28',
                dueTime: '10:00',
                priority: 'high',
                isCompleted: false,
                hasLocation: true,
                hasWeather: false,
                userId: 'test-uid',
                createdAt: { seconds: 100 },
            },
            {
                id: 't2',
                title: 'Call mom',
                dueDate: '2025-08-28',
                dueTime: '18:30',
                priority: 'low',
                isCompleted: false,
                hasLocation: false,
                hasWeather: true,
                userId: 'test-uid',
                createdAt: { seconds: 200 },
            },
        ]);

        await waitFor(() => {
            expect(screen.getByText('Buy milk')).toBeTruthy();
            expect(screen.getByText('Call mom')).toBeTruthy();
        });
    });
});
