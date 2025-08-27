import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import AddEditTaskScreen from '@/components/ui/screen/home/AddEditTaskScreen';
import * as FS from 'firebase/firestore';
import { Alert } from 'react-native';

jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('AddEditTaskScreen', () => {
    const navigate = jest.fn();
    const navigation = { navigate, goBack: jest.fn() };

    it('shows alert when saving without title', async () => {
        render(<AddEditTaskScreen navigation={navigation} route={{ params: {} }} />);

        fireEvent.press(screen.getByText(/save/i));
        await waitFor(() => {
            expect(Alert.alert).toHaveBeenCalled();
        });
    });

    it('calls setDoc when title is provided', async () => {
        render(<AddEditTaskScreen navigation={navigation} route={{ params: {} }} />);

        const titleInput = screen.getByPlaceholderText(/enter task title/i);
        fireEvent.changeText(titleInput, 'Test Task');

        fireEvent.press(screen.getByText(/save/i));

        await waitFor(() => {
            expect(FS.setDoc).toHaveBeenCalled();
        });
    });
});
