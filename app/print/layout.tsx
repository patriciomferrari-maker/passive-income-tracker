
import '../globals.css';
import './print.css';

export const metadata = {
    title: 'Reporte Financiero',
    description: 'Generado automáticamente',
};

export default function PrintLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es">
            <body className="bg-white print:bg-white min-h-screen">
                {children}
            </body>
        </html>
    );
}
