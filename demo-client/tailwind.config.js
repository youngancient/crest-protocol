/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                rootstock: {
                    orange: '#FF9100',
                    dark: '#1D1D1B',
                    light: '#F5F5F5'
                }
            }
        },
    },
    plugins: [],
}
