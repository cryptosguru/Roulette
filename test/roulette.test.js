const { time } = require('@openzeppelin/test-helpers');
const { getDeployerWallet, getWallets } = require('./libs/wallets');
const rouletteInteractor = require('./libs/rouletteInteractor');
const daiMockInteractor = require('./libs/daiMockInteractor');

const wallets = getWallets();

const BetType = {
  'Number': 0,
  'Color': 1,
  'Even': 2,
  'Column': 3,
  'Dozen': 4,
  'Half': 5,
};

const Color = {
  'Green': 0,
  'Red': 1,
  'Black': 2,
};

function betFor(betType, wallet) {
  return async function (value, result, amount = 1) {
    await rouletteInteractor.rollBets(wallet, [
      {
        betType,
        value,
        amount,
      }
    ], result);
  }
}

contract('Roulette', async () => {
  describe('with liquidity', async () => {
    it('should add liquidity', async () => {
      await rouletteInteractor.setBetFee(0, {from: getDeployerWallet().address});
      const wallet = wallets[0];
      await daiMockInteractor.mint(wallet.address, 150);
      await rouletteInteractor.addLiquidity(wallet, 30);
      assert.equal(120, await daiMockInteractor.balanceOf(wallet.address));
      assert.equal(30, await rouletteInteractor.getTotalLiquidity());
    });
    it('should remove liquidity', async () => {
      const wallet = wallets[0];
      await rouletteInteractor.removeLiquidity(wallet);
      assert.equal(150, await daiMockInteractor.balanceOf(wallet.address));
      assert.equal(0, await rouletteInteractor.getTotalLiquidity());
    });
    it('should add and remove liquidity for multiple providers', async () => {
      const wallet1 = wallets[0];
      const wallet2 = wallets[1];
      const wallet3 = wallets[2];
      await daiMockInteractor.mint(wallet2.address, 150);
      await daiMockInteractor.mint(wallet3.address, 150);
  
      // Check adding liquidity
      await rouletteInteractor.addLiquidity(wallet1, 50);
      await rouletteInteractor.addLiquidity(wallet2, 50);
      await rouletteInteractor.addLiquidity(wallet3, 50);
      assert.equal(100, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(100, await daiMockInteractor.balanceOf(wallet2.address));
      assert.equal(100, await daiMockInteractor.balanceOf(wallet3.address));
      assert.equal(150, await rouletteInteractor.getTotalLiquidity());
  
      // Check removing liquidity
      await rouletteInteractor.removeLiquidity(wallet1);
      await rouletteInteractor.removeLiquidity(wallet2);
      await rouletteInteractor.removeLiquidity(wallet3);
      assert.equal(150, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(150, await daiMockInteractor.balanceOf(wallet2.address));
      assert.equal(150, await daiMockInteractor.balanceOf(wallet3.address));
      assert.equal(0, await rouletteInteractor.getTotalLiquidity());
    });
    it('should withdraw more when pool increases', async () => {
      const wallet1 = wallets[0];
      const wallet2 = wallets[1];
      const wallet3 = wallets[2];
  
      // Check pool positve returns
      await rouletteInteractor.addLiquidity(wallet1, 50);
      await rouletteInteractor.addLiquidity(wallet2, 50);
      await rouletteInteractor.addLiquidity(wallet3, 50);
      await rouletteInteractor.mintDAI(150);
      assert.equal(300, await rouletteInteractor.getTotalLiquidity());
      await rouletteInteractor.removeLiquidity(wallet1);
      await rouletteInteractor.removeLiquidity(wallet2);
      await rouletteInteractor.removeLiquidity(wallet3);
      assert.equal(0, await rouletteInteractor.getTotalLiquidity());
      assert.equal(200, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(200, await daiMockInteractor.balanceOf(wallet2.address));
      assert.equal(200, await daiMockInteractor.balanceOf(wallet3.address));
    });
    it('should withdraw less when pool decreases', async () => {
      const wallet1 = wallets[0];
      const wallet2 = wallets[1];
      const wallet3 = wallets[2];
  
      // Check pool negative returns
      await rouletteInteractor.addLiquidity(wallet1, 100);
      await rouletteInteractor.addLiquidity(wallet2, 100);
      await rouletteInteractor.addLiquidity(wallet3, 100);
      await rouletteInteractor.burnDai(60);
      assert.equal(240, await rouletteInteractor.getTotalLiquidity());
      await rouletteInteractor.removeLiquidity(wallet1);
      await rouletteInteractor.removeLiquidity(wallet2);
      await rouletteInteractor.removeLiquidity(wallet3);
      assert.equal(0, await rouletteInteractor.getTotalLiquidity());
      assert.equal(180, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(180, await daiMockInteractor.balanceOf(wallet2.address));
      assert.equal(180, await daiMockInteractor.balanceOf(wallet3.address));
    });
    it('should manage equity with dynamic liquidity', async () => {
      const wallet1 = wallets[0];
      const wallet2 = wallets[1];
      const wallet3 = wallets[2];
  
      // Check pool negative returns
      await rouletteInteractor.addLiquidity(wallet1, 100);
      await rouletteInteractor.addLiquidity(wallet2, 100);
      await rouletteInteractor.addLiquidity(wallet3, 100);
      await rouletteInteractor.burnDai(12);
      assert.equal(288, await rouletteInteractor.getTotalLiquidity());
      await rouletteInteractor.removeLiquidity(wallet1);
      assert.equal(176, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(288-96, await rouletteInteractor.getTotalLiquidity());
      await rouletteInteractor.mintDAI(100);
      assert.equal(288-96+100, await rouletteInteractor.getTotalLiquidity());
      await rouletteInteractor.removeLiquidity(wallet2);
      await rouletteInteractor.removeLiquidity(wallet3);
      assert.equal(226, await daiMockInteractor.balanceOf(wallet2.address));
      assert.equal(226, await daiMockInteractor.balanceOf(wallet3.address));
    });
    it('should work with big shares', async () => {
      const wallet1 = wallets[1];
      const wallet2 = wallets[2];
      const poolingAmount = 1e8;
      await daiMockInteractor.burn(wallet1.address, await daiMockInteractor.balanceOf(wallet1.address));
      await daiMockInteractor.burn(wallet2.address, await daiMockInteractor.balanceOf(wallet2.address));
      assert.equal(0, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(0, await daiMockInteractor.balanceOf(wallet2.address));
      await daiMockInteractor.mint(wallet1.address, poolingAmount);
      await daiMockInteractor.mint(wallet2.address, poolingAmount);
      assert.equal(1e8, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(1e8, await daiMockInteractor.balanceOf(wallet2.address));
      await rouletteInteractor.addLiquidity(wallet1, poolingAmount);
      await rouletteInteractor.addLiquidity(wallet2, poolingAmount);
      assert.equal(0, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(0, await daiMockInteractor.balanceOf(wallet2.address));
      await rouletteInteractor.removeLiquidity(wallet1);
      await rouletteInteractor.removeLiquidity(wallet2);
      assert.equal(1e8, await daiMockInteractor.balanceOf(wallet1.address));
      assert.equal(1e8, await daiMockInteractor.balanceOf(wallet2.address));
    });
  });
  describe('with single bets', async () => {
    const wallet = wallets[4];
    it('should setup initial DAI', async () => {
      await rouletteInteractor.mintDAI(1000);
      await daiMockInteractor.mint(wallet.address, 100);
    })
    describe('when betting color', async () => {
      const betColor = betFor(BetType.Color, wallet);

      it('should lose if outcome is not of bet color', async () => {
        assert.equal(100, await daiMockInteractor.balanceOf(wallet.address));
        await betColor(Color.Red, 2, 2); // 2 is black
        assert.equal(98, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1002, await rouletteInteractor.getTotalLiquidity());

        await betColor(Color.Black, 18, 2); // 18 is red
        assert.equal(96, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1004, await rouletteInteractor.getTotalLiquidity());
      });
      it('should lose if outcome is zero', async () => {
        await betColor(Color.Black, 0, 2);
        assert.equal(94, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1006, await rouletteInteractor.getTotalLiquidity());

        await betColor(Color.Red, 0, 2);
        assert.equal(92, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1008, await rouletteInteractor.getTotalLiquidity());
      });
      it('should win if outcome is the bet color', async () => {
        await betColor(Color.Black, 2, 8);
        assert.equal(100, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1000, await rouletteInteractor.getTotalLiquidity());
      });
    });
    describe('when betting column', async () => {
      const betColumn = betFor(BetType.Column, wallet);

      it('should lose if outcome is not of bet column', async () => {
        await betColumn(0, 1);
        await betColumn(0, 4);
        await betColumn(0, 5);
        await betColumn(0, 31);
        await betColumn(0, 32);
        await betColumn(1, 0);
        await betColumn(1, 3);
        await betColumn(1, 5);
        await betColumn(1, 30);
        await betColumn(1, 32);
        await betColumn(2, 0);
        await betColumn(2, 3);
        await betColumn(2, 4);
        await betColumn(2, 30);
        await betColumn(2, 31);
        assert.equal(85, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1015, await rouletteInteractor.getTotalLiquidity());
      });
      it('should lose if outcome is zero', async () => {
        await betColumn(0, 0);
        await betColumn(1, 0);
        await betColumn(2, 0);
        assert.equal(82, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1018, await rouletteInteractor.getTotalLiquidity());
      });
      it('should win if outcome is the bet column', async () => {
        await betColumn(0, 12, 1);
        assert.equal(84, await daiMockInteractor.balanceOf(wallet.address));
        await betColumn(1, 31, 4);
        await betColumn(2, 5, 4);
        assert.equal(100, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1000, await rouletteInteractor.getTotalLiquidity());
      });
    });
    describe('when betting half', async () => {
      const betHalf = betFor(BetType.Half, wallet);

      it('should lose if outcome is not of bet half', async () => {
        await betHalf(0, 20);
        await betHalf(0, 24);
        await betHalf(0, 32);
        await betHalf(1, 4);
        await betHalf(1, 10);
        await betHalf(1, 19);
        assert.equal(94, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1006, await rouletteInteractor.getTotalLiquidity());
      });
      it('should lose if outcome is zero', async () => {
        await betHalf(0, 0);
        await betHalf(1, 0);
        assert.equal(92, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1008, await rouletteInteractor.getTotalLiquidity());
      });
      it('should win if outcome is the bet half', async () => {
        await betHalf(0, 4, 4);
        assert.equal(96, await daiMockInteractor.balanceOf(wallet.address));
        await betHalf(1, 20, 4);
        assert.equal(100, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1000, await rouletteInteractor.getTotalLiquidity());
      });
    });
    describe('when betting dozen', async () => {
      const betDozen = betFor(BetType.Dozen, wallet);
      it('should lose if outcome is not of bet dozen', async () => {
        await betDozen(0, 20);
        await betDozen(0, 24);
        await betDozen(1, 32);
        await betDozen(1, 4);
        await betDozen(2, 3);
        await betDozen(2, 19);
        assert.equal(94, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1006, await rouletteInteractor.getTotalLiquidity());
      });
      it('should lose if outcome is zero', async () => {
        await betDozen(0, 0);
        await betDozen(1, 0);
        await betDozen(2, 0);
        assert.equal(91, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1009, await rouletteInteractor.getTotalLiquidity());
      });
      it('should win if outcome is the bet dozen', async () => {
        await betDozen(0, 5, 2);
        await betDozen(1, 21, 2);
        await betDozen(2, 31);
        await betDozen(2, 1);
        assert.equal(100, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1000, await rouletteInteractor.getTotalLiquidity());
      });
    });
    describe('when betting parity', async () => {
      const betEven = betFor(BetType.Even, wallet);

      it('should lose if outcome is not of bet parity', async () => {
        await betEven(0, 11);
        await betEven(0, 3);
        await betEven(1, 32);
        await betEven(1, 4);
        assert.equal(96, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1004, await rouletteInteractor.getTotalLiquidity());
      });
      it('should lose if outcome is zero', async () => {
        await betEven(0, 0);
        await betEven(1, 0);
        assert.equal(94, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1006, await rouletteInteractor.getTotalLiquidity());
      });
      it('should win if outcome is the bet parity', async () => {
        await betEven(0, 32, 3);
        assert.equal(97, await daiMockInteractor.balanceOf(wallet.address));
        await betEven(1, 15, 3);
        assert.equal(100, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1000, await rouletteInteractor.getTotalLiquidity());
      });
    });
    describe('when betting number', async () => {
      const betNumber = betFor(BetType.Number, wallet);

      it('should lose if outcome is not of bet number', async () => {
        await betNumber(0, 11, 10);
        await betNumber(4, 3, 10);
        await betNumber(12, 32, 10);
        await betNumber(32, 4, 10);
        assert.equal(60, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(1040, await rouletteInteractor.getTotalLiquidity());
      });
      it('should win if outcome is the bet number', async () => {
        await betNumber(0, 0);
        assert.equal(95, await daiMockInteractor.balanceOf(wallet.address));
        await betNumber(14, 14);
        assert.equal(130, await daiMockInteractor.balanceOf(wallet.address));
        assert.equal(970, await rouletteInteractor.getTotalLiquidity());
      });
    });
  });
  describe('with max bets', async () => {
    const wallet = wallets[4];
    const betNumber = betFor(BetType.Number, wallet);
    it('should fail if exceeds max bet by liquidity percentage', async () => {
      const liquidity = await rouletteInteractor.getTotalLiquidity();
      const maxBet = await rouletteInteractor.getMaxBet();
      assert.equal(maxBet, liquidity / 100);
      try {
        await betNumber(0, 1, 1 + liquidity / 100);
      } catch (error) {
        assert.equal(error.reason, 'Your bet exceeds the max allowed');
      }
    });
    it('should fail if exceeds max bet by fixed max', async () => {
      await rouletteInteractor.mintDAI(120000);
      const newMaxBet = await rouletteInteractor.getMaxBet();
      assert.equal(newMaxBet, 100);
      try {
        await betNumber(0, 1, 102);
      } catch (error) {
        assert.equal(error.reason, 'Your bet exceeds the max allowed');
      }
      await rouletteInteractor.burnDai(120000);
    });
  });
  describe('with failing requests', async () => {
    const wallet = wallets[4];
    let initialBalance;
    let requestId;
    it('should not redeem if timelock has not passed', async () => {
      initialBalance = await daiMockInteractor.balanceOf(wallet.address);
      await rouletteInteractor.rollBets(wallet, [
        {
          betType: BetType.Number,
          value: 0,
          amount: 1,
        }
      ], 1, 0, false);
      assert.equal(initialBalance - 1, await daiMockInteractor.balanceOf(wallet.address));
      requestId = await rouletteInteractor.getLastRequestId();
      try {
        await rouletteInteractor.redeem(requestId);
      } catch (error) {
        assert.equal(error.reason, 'Redeem time not passed');
      }
      await time.increase(time.duration.hours(1));
      try {
        await rouletteInteractor.redeem(requestId);
      } catch (error) {
        assert.equal(error.reason, 'Redeem time not passed');
      }
    });
    it('should redeem after timelock and unresolved', async () => {
      await time.increase(time.duration.hours(2));
      console.log('requestId', requestId)
      await rouletteInteractor.redeem(requestId);
      assert.equal(initialBalance, await daiMockInteractor.balanceOf(wallet.address));
    });
    it('should not redeem if already redeemed', async () => {
      try {
        await rouletteInteractor.redeem(requestId);
      } catch (error) {
        assert.equal(error.reason, 'requestId already completed');
      }
    });
    it('should not redeem if it was resolved', async () => {
      await rouletteInteractor.rollBets(wallet, [
        {
          betType: BetType.Number,
          value: 0,
          amount: 1,
        }
      ], 1, 0, false);
      requestId = await rouletteInteractor.getLastRequestId();
      await rouletteInteractor.signLastBlockVRFRequest(1);
      try {
        await rouletteInteractor.redeem(requestId);
      } catch (error) {
        assert.equal(error.reason, 'requestId already completed');
      }
    });
  });
  describe('with mixed bets', async () => {
    const wallet = wallets[4];
    describe('with predefined set #1', async () => {
      it('should return expected win', async () => {
        const bets = [
          {
            betType: BetType.Color,
            value: Color.Red,
            amount: 3,
          },
          {
            betType: BetType.Half,
            value: 0,
            amount: 4,
          },
        ];
        await rouletteInteractor.rollBets(wallet, bets, 0); // LOSE
        assert.equal(122, await daiMockInteractor.balanceOf(wallet.address));
        await rouletteInteractor.rollBets(wallet, bets, 1); // +7
        assert.equal(129, await daiMockInteractor.balanceOf(wallet.address));
        await rouletteInteractor.rollBets(wallet, bets, 11); // +1
        assert.equal(130, await daiMockInteractor.balanceOf(wallet.address));
        await rouletteInteractor.rollBets(wallet, bets, 25); // -1
        assert.equal(129, await daiMockInteractor.balanceOf(wallet.address));
      });
    });
    describe('with predefined set #2', async () => {
      it('should return expected win', async () => {

      });
    });
    describe('with random sets', async () => {
      it('should return expected win', async () => {

      });
    });
  });
  describe('with fees', async () => {
    const wallet = wallets[5];
    it('should set bet fee', async () => {
      await rouletteInteractor.setBetFee(0.02);
      assert.equal(0.02, await rouletteInteractor.getBetFee());
    });
    it('should bet with fee', async () => {
      await rouletteInteractor.mintDAI(1000);
      await daiMockInteractor.mint(wallet.address, 100);
      const bets = [
        {
          betType: BetType.Color,
          value: Color.Red,
          amount: 3,
        },
        {
          betType: BetType.Half,
          value: 0,
          amount: 4,
        },
      ];
      await rouletteInteractor.rollBets(wallet, bets, 1); // +7
      await rouletteInteractor.rollBets(wallet, bets, 1); // +7
      assert.equal(await rouletteInteractor.getCollectedFees(), 0.04);
      assert.equal(await daiMockInteractor.balanceOf(wallet.address), 114 - 0.04);
    });
    it('should collect fee', async () => {
      const initialDeployerBalance = await daiMockInteractor.balanceOf(getDeployerWallet().address);
      await rouletteInteractor.withdrawFees();
      assert.equal(await rouletteInteractor.getCollectedFees(), 0);
      assert.equal(await daiMockInteractor.balanceOf(getDeployerWallet().address), initialDeployerBalance + 0.04);
    });
  });
});
