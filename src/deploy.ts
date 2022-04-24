import { deploy } from '.';
import { argv } from 'process';
import { PrivateKey } from 'snarkyjs';

const main = async () => {
  await deploy(
    argv[0],
    argv[1],
    Number(argv[2]),
    argv[3],
    argv[4],
    PrivateKey.fromBase58(argv[5])
  );
};

main();
