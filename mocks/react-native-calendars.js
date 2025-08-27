const React = require('react');
const { View, Text } = require('react-native');

function Calendar(props) {
    return React.createElement(
        View,
        { testID: 'mock-calendar', ...props },
        React.createElement(Text, null, 'Calendar Stub')
    );
}

module.exports = { Calendar };
