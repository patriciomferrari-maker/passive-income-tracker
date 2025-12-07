import React from 'react';

export function FlagARG({ className = "w-6 h-6" }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 9 6" className={className}>
            <rect fill="#75AADB" width="9" height="6" />
            <rect fill="#FFF" y="2" width="9" height="2" />
            <g transform="translate(3.5, 2)">
                <circle fill="#F6B40E" cx="1" cy="1" r="0.7" />
            </g>
        </svg>
    );
}

export function FlagUSA({ className = "w-6 h-6" }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 7410 3900" className={className}>
            <rect fill="#B22234" width="7410" height="3900" />
            <path d="M0,450H7410M0,1050H7410M0,1650H7410M0,2250H7410M0,2850H7410M0,3450H7410" stroke="#FFF" strokeWidth="300" />
            <rect fill="#3C3B6E" width="2964" height="2100" />
            <g fill="#FFF">
                <g id="s18">
                    <g id="s9">
                        <g id="s5">
                            <g id="s4">
                                <path id="s" d="M247,90 317.534,307.082 132.873,172.918H361.127L176.466,307.082z" />
                                <use xlinkHref="#s" y="420" />
                                <use xlinkHref="#s" y="840" />
                                <use xlinkHref="#s" y="1260" />
                            </g>
                            <use xlinkHref="#s" y="1680" />
                        </g>
                        <use xlinkHref="#s4" x="247" y="210" />
                    </g>
                    <use xlinkHref="#s9" x="494" />
                </g>
                <use xlinkHref="#s18" x="988" />
                <use xlinkHref="#s9" x="1976" />
                <use xlinkHref="#s5" x="2470" />
            </g>
        </svg>
    );
}
