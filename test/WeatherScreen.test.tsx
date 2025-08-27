import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import WeatherScreen from '@/components/ui/screen/home/WeatherScreen';
import {beforeEach, describe, it} from "node:test";
import expect from "expect";

describe('WeatherScreen', () => {
    beforeEach(() => {
        // mock fetch for OpenWeather
        global.fetch = jest.fn(async () => ({
            ok: true,
            json: async () => ({
                weather: [{ main: 'Clouds', icon: '04d' }],
                main: { temp: 27 },
            }),
        })) as any;
    });

    it('renders weather data after load', async () => {
        render(<WeatherScreen />);

        await waitFor(() => {
            expect(screen.getByText('Clouds')).toBeTruthy();
            expect(screen.getByText(/27°C/)).toBeTruthy();
        });
    });
});
