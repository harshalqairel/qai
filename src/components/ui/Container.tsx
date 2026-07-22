type ContainerProps = {
  children: React.ReactNode;
};

export default function Container({
  children,
}: ContainerProps) {
  return (
    <div className="mx-auto max-w-md p-6">
      {children}
    </div>
  );
}