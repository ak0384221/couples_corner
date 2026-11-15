export function Heart({ size = 56 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="text-heart"
      fill="currentColor"
    >
      <path d="M12 21.2S3.7 16 1.6 10.7C-.7 5.1 4.9 1.4 9 4.3c1.2.8 2.3 2 3 3.3.7-1.3 1.8-2.5 3-3.3 4.1-2.9 9.7.8 7.4 6.4C20.3 16 12 21.2 12 21.2Z" />
    </svg>
  );
}
